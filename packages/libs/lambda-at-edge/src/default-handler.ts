// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import {
  ExternalRoute,
  PublicFileRoute,
  RedirectRoute,
  RenderRoute,
  routeDefault,
  StaticRoute,
  UnauthorizedRoute
} from "@sls-next/core";

import {
  CloudFrontRequest,
  CloudFrontResultResponse,
  CloudFrontS3Origin
} from "aws-lambda";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestEvent,
  OriginResponseEvent,
  PerfLogger,
  PreRenderedManifest as PrerenderManifestType,
  RoutesManifest
} from "./types";
import { performance } from "perf_hooks";
import { OutgoingHttpHeaders, ServerResponse } from "http";
import type { Readable } from "stream";
import { externalRewrite } from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";
import { buildS3RetryStrategy } from "./s3/s3RetryStrategy";
import { getLocalePrefixFromUri } from "./routing/locale-utils";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";

const basePath = RoutesManifestJson.basePath;

const perfLogger = (logLambdaExecutionTimes: boolean): PerfLogger => {
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
    log: () => {}
  };
};

const addS3HostHeader = (
  req: CloudFrontRequest,
  s3DomainName: string
): void => {
  req.headers["host"] = [{ key: "host", value: s3DomainName }];
};

const isDataRequest = (uri: string): boolean => uri.startsWith("/_next/data");

const normaliseS3OriginDomain = (s3Origin: CloudFrontS3Origin): string => {
  if (s3Origin.region === "us-east-1") {
    return s3Origin.domainName;
  }

  if (!s3Origin.domainName.includes(s3Origin.region)) {
    const regionalEndpoint = s3Origin.domainName.replace(
      "s3.amazonaws.com",
      `s3.${s3Origin.region}.amazonaws.com`
    );
    return regionalEndpoint;
  }

  return s3Origin.domainName;
};

const normaliseDataRequestUri = (
  uri: string,
  manifest: OriginRequestDefaultHandlerManifest
): string => {
  let normalisedUri = uri
    .replace(`/_next/data/${manifest.buildId}`, "")
    .replace(".json", "");

  // Normalise to "/" for index data request
  normalisedUri = ["/index", ""].includes(normalisedUri) ? "/" : normalisedUri;

  return normalisedUri;
};

const router = (
  manifest: OriginRequestDefaultHandlerManifest,
  routesManifest: RoutesManifestJson
): ((uri: string) => string) => {
  const {
    pages: { ssr, html }
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return (uri: string): string => {
    let normalisedUri = uri;

    if (isDataRequest(uri)) {
      normalisedUri = normaliseDataRequestUri(normalisedUri, manifest);
    }

    if (ssr.nonDynamic[normalisedUri]) {
      return ssr.nonDynamic[normalisedUri];
    }

    if (html.nonDynamic[normalisedUri]) {
      return html.nonDynamic[normalisedUri];
    }

    // Dynamic routes are matched first
    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(normalisedUri);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // Then catch all routes are matched
    for (const route in ssr.catchAll) {
      const { file, regex } = ssr.catchAll[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(normalisedUri);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // Only use the 404 page if the project exports it
    if (html.nonDynamic["/404"] !== undefined) {
      return `pages${getLocalePrefixFromUri(uri, routesManifest)}/404.html`;
    }

    return "pages/_error.js";
  };
};

/**
 * Checks whether static page exists (HTML/SSG) in the manifest.
 * @param route
 * @param manifest
 */
const doesStaticPageExist = (
  route: string,
  manifest: OriginRequestDefaultHandlerManifest
) => {
  return (
    manifest.pages.html.nonDynamic[route] ||
    manifest.pages.ssg.nonDynamic[route]
  );
};

export const handler = async (
  event: OriginRequestEvent | OriginResponseEvent
): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  let response: CloudFrontResultResponse | CloudFrontRequest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const routesManifest: RoutesManifest = RoutesManifestJson;

  const { now, log } = perfLogger(manifest.logLambdaExecutionTimes);

  const tHandlerBegin = now();

  if (isOriginResponse(event)) {
    response = await handleOriginResponse({
      event,
      manifest,
      prerenderManifest,
      routesManifest
    });
  } else {
    response = await handleOriginRequest({
      event,
      manifest,
      prerenderManifest,
      routesManifest
    });
  }

  // Add custom headers to responses only.
  // TODO: for paths that hit S3 origin, it will match on the rewritten URI, i.e it may be rewritten to S3 key.
  if (response.hasOwnProperty("status")) {
    const request = event.Records[0].cf.request;

    addHeadersToResponse(
      request.uri,
      response as CloudFrontResultResponse,
      routesManifest
    );
  }

  // Remove blacklisted headers
  if (response.headers) {
    removeBlacklistedHeaders(response.headers);
  }

  const tHandlerEnd = now();

  log("handler execution time", tHandlerBegin, tHandlerEnd);

  return response;
};

const staticRequest = (
  request: CloudFrontRequest,
  file: string,
  path: string
) => {
  const s3Origin = request.origin?.s3 as CloudFrontS3Origin;
  const s3Domain = normaliseS3OriginDomain(s3Origin);
  s3Origin.domainName = s3Domain;
  s3Origin.path = path;
  request.uri = file;
  addS3HostHeader(request, s3Domain);
  return request;
};

const renderResponse = async (
  event: OriginRequestEvent,
  manifest: OriginRequestDefaultHandlerManifest,
  pagePath: string,
  isData: boolean
) => {
  const { now, log } = perfLogger(manifest.logLambdaExecutionTimes);
  const tBeforePageRequire = now();
  const page = require(`./${pagePath}`); // eslint-disable-line
  const tAfterPageRequire = now();

  log("require JS execution time", tBeforePageRequire, tAfterPageRequire);

  const tBeforeSSR = now();

  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression
    }
  );
  try {
    // If page is _error.js, set status to 404 so _error.js will render a 404 page
    if (pagePath === "pages/_error.js") {
      res.statusCode = 404;
    }

    // Render page
    if (isData) {
      const { renderOpts } = await page.renderReqToHTML(
        req,
        res,
        "passthrough"
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(renderOpts.pageData));
    } else {
      await Promise.race([page.render(req, res), responsePromise]);
    }
  } catch (error) {
    // Set status to 500 so _error.js will render a 500 page
    console.error(
      `Error rendering page: ${pagePath}. Error:\n${error}\nRendering Next.js error page.`
    );
    res.statusCode = 500;
    const errorPage = require("./pages/_error.js"); // eslint-disable-line
    await errorPage.render(req, res);
  }
  const response = await responsePromise;
  const tAfterSSR = now();

  log("SSR execution time", tBeforeSSR, tAfterSSR);

  setCloudFrontResponseStatus(response, res);

  return response;
};

const handleOriginRequest = async ({
  event,
  manifest,
  prerenderManifest,
  routesManifest
}: {
  event: OriginRequestEvent;
  manifest: OriginRequestDefaultHandlerManifest;
  prerenderManifest: PrerenderManifestType;
  routesManifest: RoutesManifest;
}) => {
  const request = event.Records[0].cf.request;

  const route = await routeDefault(
    request,
    manifest,
    prerenderManifest,
    routesManifest
  );
  if (route.isPublicFile) {
    const { file } = route as PublicFileRoute;
    return staticRequest(request, file, `${routesManifest.basePath}/public`);
  }
  if (route.querystring) {
    request.querystring = `${
      request.querystring ? request.querystring + "&" : ""
    }${route.querystring}`;
  }
  if (route.isStatic) {
    const { file, isData } = route as StaticRoute;
    const path = isData
      ? `${routesManifest.basePath}`
      : `${routesManifest.basePath}/static-pages/${manifest.buildId}`;
    const relativeFile = isData ? file : file.slice("pages".length);
    return staticRequest(request, relativeFile, path);
  }
  if (route.isRender) {
    const { page, isData } = route as RenderRoute;
    return renderResponse(event, manifest, page, isData);
  }
  if (route.isRedirect) {
    const { isRedirect, status, ...response } = route as RedirectRoute;
    return { ...response, status: status.toString() };
  }
  if (route.isExternal) {
    const { path } = route as ExternalRoute;
    return externalRewrite(event, manifest.enableHTTPCompression, path);
  }
  // No if lets typescript check this is the only option
  const unauthorized: UnauthorizedRoute = route;
  const { isUnauthorized, status, ...response } = unauthorized;
  return { ...response, status: status.toString() };
};

const handleOriginResponse = async ({
  event,
  manifest,
  prerenderManifest,
  routesManifest
}: {
  event: OriginResponseEvent;
  manifest: OriginRequestDefaultHandlerManifest;
  prerenderManifest: PrerenderManifestType;
  routesManifest: RoutesManifest;
}) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;
  const { uri } = request;
  const { status } = response;
  if (status !== "403") {
    // Set 404 status code for 404.html page. We do not need normalised URI as it will always be "/404.html"
    if (uri.endsWith("/404.html")) {
      response.status = "404";
      response.statusDescription = "Not Found";
    }
    return response;
  }

  // For PUT or DELETE just return the response as these should be unsupported S3 methods
  if (request.method === "PUT" || request.method === "DELETE") {
    return response;
  }

  const { domainName, region } = request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");

  // Lazily import only S3Client to reduce init times until actually needed
  const { S3Client } = await import("@aws-sdk/client-s3/S3Client");

  const s3 = new S3Client({
    region: request.origin?.s3?.region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });
  const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";
  let pagePath;
  const hasFallback = Object.values(manifest.pages.ssg.dynamic).find(
    (routeConfig) => {
      const re = new RegExp(routeConfig.routeRegex);
      return re.test(uri);
    }
  );
  const isFallbackBlocking = hasFallback?.fallback === null;
  if (
    (isDataRequest(uri) || isFallbackBlocking) &&
    !(pagePath = router(manifest, routesManifest)(uri)).endsWith(".html")
  ) {
    // eslint-disable-next-line
    const page = require(`./${pagePath}`);
    // Reconstruct original uri for next/router
    if (uri.endsWith(".html")) {
      request.uri = uri.slice(0, uri.length - 5);
      if (manifest.trailingSlash) {
        request.uri += "/";
      }
    }
    const { req, res, responsePromise } = lambdaAtEdgeCompat(
      event.Records[0].cf,
      {
        enableHTTPCompression: manifest.enableHTTPCompression
      }
    );
    const isSSG = !!page.getStaticProps;
    const { renderOpts, html } = await page.renderReqToHTML(
      req,
      res,
      "passthrough"
    );
    if (isSSG) {
      const baseKey = uri
        .replace(/^\//, "")
        .replace(/\.(json|html)$/, "")
        .replace(/^_next\/data\/[^\/]*\//, "");
      const jsonKey = `_next/data/${manifest.buildId}/${baseKey}.json`;
      const htmlKey = `static-pages/${manifest.buildId}/${baseKey}.html`;
      const s3JsonParams = {
        Bucket: bucketName,
        Key: `${s3BasePath}${jsonKey}`,
        Body: JSON.stringify(renderOpts.pageData),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };
      const s3HtmlParams = {
        Bucket: bucketName,
        Key: `${s3BasePath}${htmlKey}`,
        Body: html,
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };
      const { PutObjectCommand } = await import(
        "@aws-sdk/client-s3/commands/PutObjectCommand"
      );
      await Promise.all([
        s3.send(new PutObjectCommand(s3JsonParams)),
        s3.send(new PutObjectCommand(s3HtmlParams))
      ]);
    }
    const outHeaders: OutgoingHttpHeaders = {};
    Object.entries(response.headers).map(([name, headers]) => {
      outHeaders[name] = headers.map(({ value }) => value);
    });
    res.writeHead(200, outHeaders);
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=2678400, must-revalidate"
    );
    if (isDataRequest(uri)) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(renderOpts.pageData));
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    }
    return await responsePromise;
  } else {
    if (!hasFallback) return response;

    // Make sure we get locale-specific S3 page
    const localePrefix = getLocalePrefixFromUri(uri, routesManifest);

    // If route has fallback, return that page from S3, otherwise return 404 page
    const s3Key = `${s3BasePath}static-pages/${manifest.buildId}${
      hasFallback.fallback || `${localePrefix}/404.html`
    }`;

    // If 404 page does not exist based on manifest, then don't bother trying to retrieve from S3 as it will fail
    // Instead render 404 page via SSR
    if (
      !hasFallback.fallback &&
      !doesStaticPageExist(`${localePrefix}/404`, manifest)
    ) {
      const { req, res } = lambdaAtEdgeCompat(event.Records[0].cf, {
        enableHTTPCompression: manifest.enableHTTPCompression
      });

      // Render 404 page using _error.js
      // TODO: Ideally this should be done in request handler but we will refactor at later time
      // FIXME: somehow not able to get the headers from the SSR'd response to return correctly
      const page = require("./pages/_error.js");
      const { html } = await page.renderReqToHTML(req, res, "passthrough");

      return {
        status: "404",
        statusDescription: "Not Found",
        headers: {
          ...response.headers,
          "content-type": [
            {
              key: "Content-Type",
              value: "text/html"
            }
          ]
        },
        body: html
      };
    } else {
      const { GetObjectCommand } = await import(
        "@aws-sdk/client-s3/commands/GetObjectCommand"
      );
      // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
      const getStream = await import("get-stream");

      const s3Params = {
        Bucket: bucketName,
        Key: s3Key
      };

      const s3Response = await s3.send(new GetObjectCommand(s3Params));
      const bodyString = await getStream.default(s3Response.Body as Readable);

      return {
        status: hasFallback.fallback ? "200" : "404",
        statusDescription: hasFallback.fallback ? "OK" : "Not Found",
        headers: {
          ...response.headers,
          "content-type": [
            {
              key: "Content-Type",
              value: "text/html"
            }
          ],
          "cache-control": [
            {
              key: "Cache-Control",
              value:
                s3Response.CacheControl ??
                (hasFallback.fallback // Use cache-control from S3 response if possible, otherwise use defaults
                  ? "public, max-age=0, s-maxage=0, must-revalidate" // fallback should never be cached
                  : "public, max-age=0, s-maxage=2678400, must-revalidate")
            }
          ]
        },
        body: bodyString
      };
    }
  }
};

const isOriginResponse = (
  event: OriginRequestEvent | OriginResponseEvent
): event is OriginResponseEvent => {
  return event.Records[0].cf.config.eventType === "origin-response";
};

// This sets CloudFront response for 404 or 500 statuses
const setCloudFrontResponseStatus = (
  response: CloudFrontResultResponse,
  res: ServerResponse
): void => {
  if (res.statusCode == 404) {
    response.status = "404";
    response.statusDescription = "Not Found";
  } else if (res.statusCode == 500) {
    response.status = "500";
    response.statusDescription = "Internal Server Error";
  }
};
