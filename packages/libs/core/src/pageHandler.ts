import {
  PerfLogger,
  PreRenderedManifest as PrerenderManifestType
} from "./types";
import {
  ExternalRoute,
  handleDefault,
  PublicFileRoute,
  RoutesManifest,
  StaticRoute,
  getCustomHeaders,
  getStaticRegenerationResponse,
  getThrottledStaticRegenerationCachePolicy,
  handleFallback,
  Route
} from "./index";
import { PageManifest } from "./types";
import { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "http";
import { performance } from "perf_hooks";
import { PlatformClient } from "./platform/platformClient";

const createExternalRewriteResponse = async (
  customRewrite: string,
  req: IncomingMessage,
  res: ServerResponse,
  platformClient: PlatformClient,
  body?: string
): Promise<void> => {
  const { default: fetch } = await import("node-fetch");

  // Set request headers
  const reqHeaders: any = {};
  Object.assign(reqHeaders, req.headers);

  // Delete host header otherwise request may fail due to host mismatch
  if (reqHeaders.hasOwnProperty("host")) {
    delete reqHeaders.host;
  }

  let fetchResponse;
  if (body) {
    const decodedBody = Buffer.from(body, "base64").toString("utf8");

    fetchResponse = await fetch(customRewrite, {
      headers: reqHeaders,
      method: req.method,
      body: decodedBody, // Must pass body as a string,
      compress: false,
      redirect: "manual"
    });
  } else {
    fetchResponse = await fetch(customRewrite, {
      headers: reqHeaders,
      method: req.method,
      compress: false,
      redirect: "manual"
    });
  }

  for (const [name, val] of fetchResponse.headers.entries()) {
    if (!platformClient.isIgnoredHeader(name)) {
      res.setHeader(name, val);
    }
  }
  res.statusCode = fetchResponse.status;
  res.end(await fetchResponse.buffer());
};

const externalRewrite = async (
  req: IncomingMessage,
  res: ServerResponse,
  rewrite: string,
  platformClient: PlatformClient
): Promise<void> => {
  const querystring = req.url?.includes("?") ? req.url?.split("?") : "";
  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  await createExternalRewriteResponse(
    rewrite + (querystring ? "?" : "") + querystring,
    req,
    res,
    platformClient,
    body
  );
};

const staticRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  responsePromise: Promise<any>,
  file: string,
  path: string,
  route: Route,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  platformClient: PlatformClient
) => {
  const basePath = routesManifest.basePath;
  const pageKey = (path + file).slice(1); // need to remove leading slash from path for page key

  const staticRoute = route.isStatic ? (route as StaticRoute) : undefined;
  const statusCode = route?.statusCode ?? 200;

  // For PUT, DELETE, PATCH, POST, OPTIONS just return a 405 response as these should not be supported for a page fetch.
  // TODO: OPTIONS should be able to be supported now.
  if (
    req.method === "PUT" ||
    req.method === "DELETE" ||
    req.method === "PATCH" ||
    req.method === "POST" ||
    req.method === "OPTIONS"
  ) {
    res.writeHead(405);
    res.end();
    return await responsePromise;
  }

  // Get page response using platform client
  const pageResponse = platformClient.getObject(pageKey);

  const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";

  // These statuses are returned when S3 does not have access to the page.
  // 404 will also be returned if CloudFront has permissions to list objects.
  if (pageResponse.statusCode !== 403 && pageResponse.statusCode !== 404) {
    let cacheControl = pageResponse.headers.cacheControl;

    // If these are error pages, then just return them
    if (statusCode === 404 || statusCode === 500) {
      cacheControl =
        statusCode === 500
          ? "public, max-age=0, s-maxage=0, must-revalidate"
          : cacheControl;
    } else {
      // Otherwise we may need to do static regeneration
      const staticRegenerationResponse = getStaticRegenerationResponse({
        expiresHeader: pageResponse.headers.expires?.toString() ?? "",
        lastModifiedHeader: pageResponse.headers.lastModified?.toString() ?? "",
        initialRevalidateSeconds: staticRoute?.revalidate
      });

      if (staticRegenerationResponse) {
        cacheControl = staticRegenerationResponse.cacheControl;

        if (
          staticRoute?.page &&
          staticRegenerationResponse.secondsRemainingUntilRevalidation === 0
        ) {
          const { throttle } = await platformClient.triggerStaticRegeneration({
            basePath,
            pageKey: pageKey,
            eTag: pageResponse.headers.eTag,
            lastModified: pageResponse.headers.lastModified
              ?.getTime()
              .toString(),
            pagePath: staticRoute.page
          });

          // Occasionally we will get rate-limited by the Queue (in the event we
          // send it too many messages) and so we we use the cache to reduce
          // requests to the queue for a short period.
          if (throttle) {
            cacheControl =
              getThrottledStaticRegenerationCachePolicy(1).cacheControl;
          }
        }
      }
    }

    // Get custom headers and convert it into a plain object
    const customHeaders = getCustomHeaders(req.url ?? "", routesManifest);
    const convertedCustomHeaders: { [key: string]: string } = {};
    for (const key in customHeaders) {
      convertedCustomHeaders[key] = customHeaders[key][0].value;
    }

    const headers: OutgoingHttpHeaders = {
      ...pageResponse.headers,
      "Cache-Control": cacheControl,
      ...convertedCustomHeaders
    };

    res.writeHead(statusCode, headers);
    res.end(pageResponse.body);
    return await responsePromise;
  }

  const getPage = (pagePath: string) => {
    return require(`./${pagePath}`);
  };

  const fallbackRoute = await handleFallback(
    { req, res, responsePromise },
    route,
    manifest,
    routesManifest,
    getPage
  );

  // Already handled dynamic error path
  if (!fallbackRoute) {
    return await responsePromise;
  }

  // Either a fallback: true page or a static error page
  if (fallbackRoute.isStatic) {
    const file = fallbackRoute.file.slice("pages".length);
    const pageKey = `${s3BasePath}static-pages/${manifest.buildId}${file}`;

    const pageResponse = platformClient.getObject(pageKey);

    const statusCode = fallbackRoute.statusCode || 200;
    const is500 = statusCode === 500;

    const cacheControl = is500
      ? "public, max-age=0, s-maxage=0, must-revalidate" // static 500 page should never be cached
      : pageResponse.headers.CacheControl ??
        (fallbackRoute.fallback // Use cache-control from S3 response if possible, otherwise use defaults
          ? "public, max-age=0, s-maxage=0, must-revalidate" // fallback should never be cached
          : "public, max-age=0, s-maxage=2678400, must-revalidate");

    res.writeHead(statusCode, {
      "Cache-Control": cacheControl,
      "Content-Type": "text/html"
    });
    res.end(pageResponse.body);
    return await responsePromise;
  }

  // This is a fallback route that should be stored in S3 before returning it
  const { renderOpts, html } = fallbackRoute;
  const { expires } = await platformClient.storePage({
    html,
    uri: file,
    basePath,
    buildId: manifest.buildId,
    pageData: renderOpts.pageData,
    revalidate: renderOpts.revalidate
  });

  const isrResponse = expires
    ? getStaticRegenerationResponse({
        expiresHeader: expires.toJSON(),
        lastModifiedHeader: undefined,
        initialRevalidateSeconds: staticRoute?.revalidate
      })
    : null;

  const cacheControl =
    (isrResponse && isrResponse.cacheControl) ||
    "public, max-age=0, s-maxage=2678400, must-revalidate";

  res.setHeader("Cache-Control", cacheControl);

  if (fallbackRoute.route.isData) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(renderOpts.pageData));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }

  return await responsePromise;
};

const perfLogger = (logLambdaExecutionTimes?: boolean): PerfLogger => {
  if (logLambdaExecutionTimes) {
    return {
      now: () => performance.now(),
      log: (metricDescription: string, t1?: number, t2?: number): void => {
        if (!t1 || !t2) return;
        console.log(`${metricDescription}: ${t2 - t1} (ms)`);
      }
    };
  }
  return {
    now: () => 0,
    log: () => {
      // intentionally empty
    }
  };
};

/**
 * Platform-agnostic page handler that handles all pages (SSR, SSG, and API).
 * It requires passing a platform client which will implement methods for retrieving/storing pages, and triggering static regeneration.
 * @param req
 * @param res
 * @param responsePromise
 * @param manifest
 * @param prerenderManifest
 * @param routesManifest
 * @param options
 * @param platformClient
 */
export const pageHandler = async ({
  req,
  res,
  responsePromise,
  manifest,
  prerenderManifest,
  routesManifest,
  options,
  platformClient
}: {
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<any>;
  manifest: PageManifest;
  prerenderManifest: PrerenderManifestType;
  routesManifest: RoutesManifest;
  options: { logExecutionTimes: boolean };
  platformClient: PlatformClient;
}) => {
  const { now, log } = perfLogger(options.logExecutionTimes);

  let tBeforeSSR = null;
  const getPage = (pagePath: string) => {
    const tBeforePageRequire = now();
    const page = require(`./${pagePath}`); // eslint-disable-line
    const tAfterPageRequire = (tBeforeSSR = now());
    log("Require JS execution time", tBeforePageRequire, tAfterPageRequire);
    return page;
  };

  const route = await handleDefault(
    { req, res, responsePromise },
    manifest,
    prerenderManifest,
    routesManifest,
    getPage
  );
  if (tBeforeSSR) {
    const tAfterSSR = now();
    log("SSR execution time", tBeforeSSR, tAfterSSR);
  }

  if (!route) {
    return await responsePromise;
  }

  if (route.isPublicFile) {
    const { file } = route as PublicFileRoute;
    return await staticRequest(
      req,
      res,
      responsePromise,
      file,
      `${routesManifest.basePath}/public`,
      route,
      manifest,
      routesManifest,
      platformClient
    );
  }
  if (route.isStatic) {
    const { file, isData } = route as StaticRoute;
    const path = isData
      ? `${routesManifest.basePath}`
      : `${routesManifest.basePath}/static-pages/${manifest.buildId}`;

    const relativeFile = isData ? file : file.slice("pages".length);
    return await staticRequest(
      req,
      res,
      responsePromise,
      relativeFile,
      path,
      route,
      manifest,
      routesManifest,
      platformClient
    );
  }

  const external: ExternalRoute = route;
  const { path } = external;
  return externalRewrite(req, res, path, platformClient);
};
