// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";

import {
  CloudFrontOrigin,
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
import { ServerResponse } from "http";
import type { Readable } from "stream";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getLanguageRedirect,
  getRedirectPath
} from "./routing/redirector";
import {
  createExternalRewriteResponse,
  getRewritePath,
  isExternalRewrite
} from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";
import { isValidPreviewRequest } from "./lib/isValidPreviewRequest";
import { getUnauthenticatedResponse } from "./auth/authenticator";
import { buildS3RetryStrategy } from "./s3/s3RetryStrategy";
import { isLocaleIndexUri } from "./routing/locale-utils";

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

const normaliseUri = (uri: string): string => {
  if (basePath) {
    if (uri.startsWith(basePath)) {
      uri = uri.slice(basePath.length);
    } else {
      // basePath set but URI does not start with basePath, return 404
      return "/404";
    }
  }

  // Remove trailing slash for all paths
  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  // Empty path should be normalised to "/" as there is no Next.js route for ""
  return uri === "" ? "/" : uri;
};

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
  manifest: OriginRequestDefaultHandlerManifest
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

    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(normalisedUri);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // only use the 404 page if the project exports it
    if (html.nonDynamic["/404"] !== undefined) {
      return "pages/404.html";
    }

    return "pages/_error.js";
  };
};

/**
 * Remove valid locale and accept-language header from request and move it to query params.
 * Needed for SSR pages otherwise there will be a redirect loop or issue rendering.
 * @param request
 * @param routesManifest
 */
const normaliseRequestForLocale = (
  request: CloudFrontRequest,
  routesManifest: RoutesManifest
) => {
  const locales = routesManifest.i18n?.locales;
  if (locales) {
    for (const locale of locales) {
      if (request.uri === `${basePath}/${locale}`) {
        request.uri = "/";

        request.querystring += `${
          request.querystring === "" ? "" : "&"
        }nextInternalLocale=${locale}`;

        delete request.headers["accept-language"];

        break;
      } else if (request.uri.startsWith(`${basePath}/${locale}/`)) {
        request.uri = request.uri.replace(
          `${basePath}/${locale}/`,
          `${basePath}/`
        );

        request.querystring += `${
          request.querystring === "" ? "" : "&"
        }nextInternalLocale=${locale}`;

        delete request.headers["accept-language"];

        break;
      }
    }
  }
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
      prerenderManifest
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

  const tHandlerEnd = now();

  log("handler execution time", tHandlerBegin, tHandlerEnd);

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

  // Handle basic auth
  const authorization = request.headers.authorization;
  const unauthResponse = getUnauthenticatedResponse(
    authorization ? authorization[0].value : null,
    manifest.authentication
  );
  if (unauthResponse) {
    return unauthResponse;
  }

  // Handle domain redirects e.g www to non-www domain
  const domainRedirect = getDomainRedirectPath(request, manifest);
  if (domainRedirect) {
    return createRedirectResponse(domainRedirect, request.querystring, 308);
  }

  const basePath = routesManifest.basePath;
  let uri = normaliseUri(request.uri);
  const decodedUri = decodeURI(uri);
  const { pages, publicFiles } = manifest;

  let isPublicFile = publicFiles[decodedUri];
  let isDataReq = isDataRequest(uri);

  // Handle redirects
  // TODO: refactor redirect logic to another file since this is getting quite large

  // Handle any trailing slash redirects
  let newUri = request.uri;
  if (isDataReq || isPublicFile) {
    // Data requests and public files with trailing slash URL always get redirected to non-trailing slash URL
    if (newUri.endsWith("/")) {
      newUri = newUri.slice(0, -1);
    }
  } else if (request.uri !== "/" && request.uri !== "" && uri !== "/404") {
    // HTML/SSR pages get redirected based on trailingSlash in next.config.js
    // We do not redirect:
    // 1. Unnormalised URI is "/" or "" as this could cause a redirect loop due to browsers appending trailing slash
    // 2. "/404" pages due to basePath normalisation
    const trailingSlash = manifest.trailingSlash;

    if (!trailingSlash && newUri.endsWith("/")) {
      newUri = newUri.slice(0, -1);
    }

    if (trailingSlash && !newUri.endsWith("/")) {
      newUri += "/";
    }
  }

  if (newUri !== request.uri) {
    return createRedirectResponse(newUri, request.querystring, 308);
  }

  // Handle other custom redirects on the original URI
  const customRedirect = getRedirectPath(request.uri, routesManifest);
  if (customRedirect) {
    return createRedirectResponse(
      customRedirect.redirectPath,
      request.querystring,
      customRedirect.statusCode
    );
  }

  // Check for non-dynamic pages before rewriting
  const isNonDynamicRoute =
    pages.html.nonDynamic[uri] || pages.ssr.nonDynamic[uri] || isPublicFile;

  let rewrittenUri;
  // Handle custom rewrites, but don't rewrite non-dynamic pages, public files or data requests per Next.js docs: https://nextjs.org/docs/api-reference/next.config.js/rewrites
  if (!isNonDynamicRoute && !isDataReq) {
    const customRewrite = getRewritePath(
      request.uri,
      routesManifest,
      router(manifest),
      uri
    );
    if (customRewrite) {
      rewrittenUri = request.uri;
      const [customRewriteUriPath, customRewriteUriQuery] = customRewrite.split(
        "?"
      );
      request.uri = customRewriteUriPath;
      if (request.querystring) {
        request.querystring = `${request.querystring}${
          customRewriteUriQuery ? `&${customRewriteUriQuery}` : ""
        }`;
      } else {
        request.querystring = `${customRewriteUriQuery ?? ""}`;
      }

      if (isExternalRewrite(customRewriteUriPath)) {
        const { req, res, responsePromise } = lambdaAtEdgeCompat(
          event.Records[0].cf,
          {
            enableHTTPCompression: manifest.enableHTTPCompression
          }
        );
        await createExternalRewriteResponse(
          customRewriteUriPath +
            (request.querystring ? "?" : "") +
            request.querystring,
          req,
          res,
          request.body?.data
        );
        return await responsePromise;
      }

      uri = normaliseUri(request.uri);
    }
  }

  // Handle root language rewrite
  const languageHeader = request.headers["accept-language"];
  const languageRedirectUri = getLanguageRedirect(
    languageHeader ? languageHeader[0].value : undefined,
    uri,
    routesManifest,
    manifest
  );

  if (languageRedirectUri) {
    return createRedirectResponse(
      languageRedirectUri,
      request.querystring,
      307
    );
  }

  const isStaticPage = pages.html.nonDynamic[uri]; // plain page without any props
  const isPrerenderedPage = pages.ssg.nonDynamic[uri]; // prerendered/SSG pages are also static pages like "pages.html" above
  const origin = request.origin as CloudFrontOrigin;
  const s3Origin = origin.s3 as CloudFrontS3Origin;
  const isHTMLPage = isStaticPage || isPrerenderedPage;
  const normalisedS3DomainName = normaliseS3OriginDomain(s3Origin);
  const hasFallback = hasFallbackForUri(uri, prerenderManifest, manifest);
  const { now, log } = perfLogger(manifest.logLambdaExecutionTimes);
  const isPreviewRequest = isValidPreviewRequest(
    request.headers.cookie,
    prerenderManifest.preview.previewModeSigningKey
  );

  s3Origin.domainName = normalisedS3DomainName;

  S3Check: if (
    // Note: public files and static pages (HTML pages with no props) don't have JS files needed for preview mode, always serve from S3.
    isPublicFile ||
    isStaticPage ||
    (isHTMLPage && !isPreviewRequest) ||
    (hasFallback && !isPreviewRequest) ||
    (isDataReq && !isPreviewRequest)
  ) {
    if (isPublicFile) {
      s3Origin.path = `${basePath}/public`;
      if (basePath) {
        request.uri = request.uri.replace(basePath, "");
      }
    } else if (isHTMLPage || hasFallback) {
      s3Origin.path = `${basePath}/static-pages/${manifest.buildId}`;
      let pageName;
      if (isLocaleIndexUri(uri, routesManifest)) {
        pageName = `${uri}/index`;
      } else {
        pageName = uri === "/" ? "/index" : uri;
      }
      request.uri = `${pageName}.html`;
    } else if (isDataReq) {
      // We need to check whether data request is unmatched i.e routed to 404.html or _error.js
      const normalisedDataRequestUri = normaliseDataRequestUri(uri, manifest);
      const pagePath = router(manifest)(normalisedDataRequestUri);

      if (pagePath === "pages/404.html") {
        // Request static 404 page from s3
        s3Origin.path = `${basePath}/static-pages/${manifest.buildId}`;
        request.uri = pagePath.replace("pages", "");
      } else if (
        pagePath === "pages/_error.js" ||
        (!pages.ssg.nonDynamic[normalisedDataRequestUri] &&
          !hasFallbackForUri(
            normalisedDataRequestUri,
            prerenderManifest,
            manifest
          ))
      ) {
        // Break to continue to SSR render in two cases:
        // 1. URI routes to _error.js
        // 2. URI is not unmatched, but it's not in prerendered routes nor is for an SSG fallback, i.e this is an SSR data request, we need to SSR render the JSON
        break S3Check;
      }

      // Otherwise, this is an SSG data request, so continue to get to try to get the JSON from S3.
      // For fallback SSG, this will fail the first time but the origin response handler will render and store in S3.
    }

    addS3HostHeader(request, normalisedS3DomainName);
    return request;
  }

  const pagePath = router(manifest)(uri);

  if (pagePath.endsWith(".html") && !isPreviewRequest) {
    s3Origin.path = `${basePath}/static-pages/${manifest.buildId}`;
    request.uri = pagePath.replace("pages", "");
    addS3HostHeader(request, normalisedS3DomainName);

    return request;
  }

  const tBeforePageRequire = now();
  let page = require(`./${pagePath}`); // eslint-disable-line
  const tAfterPageRequire = now();

  log("require JS execution time", tBeforePageRequire, tAfterPageRequire);

  const tBeforeSSR = now();

  normaliseRequestForLocale(request, routesManifest);

  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression,
      rewrittenUri
    }
  );
  try {
    // If page is _error.js, set status to 404 so _error.js will render a 404 page
    if (pagePath === "pages/_error.js") {
      res.statusCode = 404;
    }

    // Render page
    if (isDataReq) {
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
    page = require("./pages/_error.js"); // eslint-disable-line
    await page.render(req, res);
  }
  const response = await responsePromise;
  const tAfterSSR = now();

  log("SSR execution time", tBeforeSSR, tAfterSSR);

  setCloudFrontResponseStatus(response, res);

  return response;
};

const handleOriginResponse = async ({
  event,
  manifest,
  prerenderManifest
}: {
  event: OriginResponseEvent;
  manifest: OriginRequestDefaultHandlerManifest;
  prerenderManifest: PrerenderManifestType;
}) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;
  const { status } = response;
  if (status !== "403") {
    // Set 404 status code for 404.html page. We do not need normalised URI as it will always be "/404.html"
    if (request.uri === "/404.html") {
      response.status = "404";
      response.statusDescription = "Not Found";
    }
    return response;
  }

  // For PUT or DELETE just return the response as these should be unsupported S3 methods
  if (request.method === "PUT" || request.method === "DELETE") {
    return response;
  }

  const uri = normaliseUri(request.uri);
  const { domainName, region } = request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");

  // Lazily import only S3Client to reduce init times until actually needed
  const { S3Client } = await import("@aws-sdk/client-s3/S3Client");

  const s3 = new S3Client({
    region: request.origin?.s3?.region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });
  let pagePath;
  if (
    isDataRequest(uri) &&
    !(pagePath = router(manifest)(uri)).endsWith(".html")
  ) {
    // eslint-disable-next-line
    const page = require(`./${pagePath}`);
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
      const s3JsonParams = {
        Bucket: bucketName,
        Key: `${basePath}${basePath === "" ? "" : "/"}${uri.replace(
          /^\//,
          ""
        )}`,
        Body: JSON.stringify(renderOpts.pageData),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };
      const s3HtmlParams = {
        Bucket: bucketName,
        Key: `${basePath}${basePath === "" ? "" : "/"}static-pages/${
          manifest.buildId
        }/${request.uri
          .replace(`/_next/data/${manifest.buildId}/`, "")
          .replace(".json", ".html")}`,
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
    res.writeHead(200, response.headers as any);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(renderOpts.pageData));
    return await responsePromise;
  } else {
    const hasFallback = hasFallbackForUri(uri, prerenderManifest, manifest);
    if (!hasFallback) return response;

    // If route has fallback, return that page from S3, otherwise return 404 page
    const s3Key = `${basePath}${basePath === "" ? "" : "/"}static-pages/${
      manifest.buildId
    }${hasFallback.fallback || "/404.html"}`;

    const { GetObjectCommand } = await import(
      "@aws-sdk/client-s3/commands/GetObjectCommand"
    );
    // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
    const getStream = await import("get-stream");
    let bodyString;

    const s3Params = {
      Bucket: bucketName,
      Key: s3Key
    };

    const { Body, CacheControl } = await s3.send(
      new GetObjectCommand(s3Params)
    );
    bodyString = await getStream.default(Body as Readable);

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
              CacheControl ??
              (hasFallback.fallback // Use cache-control from S3 response if possible, otherwise use defaults
                ? "public, max-age=0, s-maxage=0, must-revalidate" // fallback should never be cached
                : "public, max-age=0, s-maxage=2678400, must-revalidate")
          }
        ]
      },
      body: bodyString
    };
  }
};

const isOriginResponse = (
  event: OriginRequestEvent | OriginResponseEvent
): event is OriginResponseEvent => {
  return event.Records[0].cf.config.eventType === "origin-response";
};

const hasFallbackForUri = (
  uri: string,
  prerenderManifest: PrerenderManifestType,
  manifest: OriginRequestDefaultHandlerManifest
) => {
  const {
    pages: { ssr, html, ssg }
  } = manifest;
  // Non-dynamic routes are prioritized over dynamic fallbacks, return false to ensure those get rendered instead
  if (ssr.nonDynamic[uri] || html.nonDynamic[uri]) {
    return false;
  }

  let foundFallback:
    | {
        routeRegex: string;
        fallback: string | false | null;
        dataRoute: string;
        dataRouteRegex: string;
      }
    | undefined = undefined; // for later use to reduce duplicate work

  // Dynamic routes that does not have fallback are prioritized over dynamic fallback
  const isNonFallbackDynamicRoute = Object.values({
    ...ssr.dynamic,
    ...html.dynamic
  }).find((dynamicRoute) => {
    if (foundFallback) {
      return false;
    }

    const re = new RegExp(dynamicRoute.regex);
    const matchesRegex = re.test(uri);

    // If any dynamic route matches, check that this isn't one of the fallback routes in prerender manifest
    if (matchesRegex) {
      const matchesFallbackRoute = Object.keys(ssg.dynamic).find(
        (dynamicSsgRoute) => {
          const fileMatchesPrerenderRoute =
            dynamicRoute.file === `pages${dynamicSsgRoute}.js`;

          if (fileMatchesPrerenderRoute) {
            foundFallback = ssg.dynamic[dynamicSsgRoute];
          }

          return fileMatchesPrerenderRoute;
        }
      );

      return !matchesFallbackRoute;
    } else {
      return false;
    }
  });

  if (isNonFallbackDynamicRoute) {
    return false;
  }

  // If fallback previously found, return it to prevent additional regex matching
  if (foundFallback) {
    return foundFallback;
  }

  // Otherwise, try to match fallback against dynamic routes in prerender manifest
  return Object.values(ssg.dynamic).find((routeConfig) => {
    const re = new RegExp(routeConfig.routeRegex);
    return re.test(uri);
  });
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
