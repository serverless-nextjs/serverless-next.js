// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import ImagesManifest from "./images-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import lambdaAtEdgeCompat from "@getjerry/next-aws-cloudfront";

import {
  CloudFrontOrigin,
  CloudFrontRequest,
  CloudFrontResultResponse,
  CloudFrontS3Origin,
  Context
} from "aws-lambda";

import { CloudFrontClient } from "@aws-sdk/client-cloudfront/CloudFrontClient";
import { LambdaClient } from "@aws-sdk/client-lambda/LambdaClient";
import { PutObjectCommand } from "@aws-sdk/client-s3/commands/PutObjectCommand";
import { GetObjectCommand } from "@aws-sdk/client-s3/commands/GetObjectCommand";

import { S3Client } from "@aws-sdk/client-s3/S3Client";

import { InvokeCommand } from "@aws-sdk/client-lambda";

import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestEvent,
  OriginResponseEvent,
  PerfLogger,
  PreRenderedManifest as PrerenderManifestType,
  RevalidationEvent,
  RoutesManifest
} from "../types";
import { performance } from "perf_hooks";
import { ServerResponse } from "http";
import type { Readable } from "stream";
import { createNotFoundResponse, isNotFoundPage } from "./routing/notfound";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getRedirectPath
} from "./routing/redirector";
import {
  createExternalRewriteResponse,
  getRewritePath,
  isExternalRewrite
} from "./routing/rewriter";
import {
  addHeadersToResponse,
  addS3HeadersToResponse
} from "./headers/addHeaders";
import {
  isValidPreviewRequest,
  setJerryAuth
} from "./lib/PreviewRequestHelper";
import { getUnauthenticatedResponse } from "./auth/authenticator";
import { buildS3RetryStrategy } from "./s3/s3RetryStrategy";
import { createETag } from "./lib/etag";
import { ResourceService } from "./services/resource.service";
import { CloudFrontService } from "./services/cloudfront.service";
import { S3Service } from "./services/s3.service";
import { RevalidateHandler } from "./handler/revalidate.handler";
import { RenderService } from "./services/render.service";
import { debug, isDevMode } from "./lib/console";
import { PERMANENT_STATIC_PAGES_DIR } from "./lib/permanentStaticPages";
import { CloudFrontHeaders } from "aws-lambda/common/cloudfront";

process.env.PRERENDER = "true";
process.env.DEBUGMODE = Manifest.enableDebugMode;

interface FoundFallbackInterface {
  routeRegex: string;
  fallback: string | false | null;
  dataRoute: string;
  dataRouteRegex: string;
}

const resourceService = new ResourceService(
  Manifest,
  PrerenderManifest,
  RoutesManifestJson
);

const lambda = new LambdaClient({ region: "us-east-1" });

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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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

const normaliseUri = (uri: string, isS3Response = false): string => {
  // Remove first characters when
  // 1. not s3 response
  // 2. has basepath property
  // 3. uri starts with basepath
  if (!isS3Response && basePath && uri.startsWith(basePath)) {
    uri = uri.slice(basePath.length);
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
    debug(`[router] uri: ${uri}`);

    let normalisedUri = uri;

    if (isDataRequest(uri)) {
      normalisedUri = normaliseDataRequestUri(normalisedUri, manifest);
    }

    if (ssr.nonDynamic[normalisedUri]) {
      // log in prod
      console.log(
        `[router] ssr.nonDynamic matched, uri: ${uri}\n- normalisedUri: ${normalisedUri}\n- result:${ssr.nonDynamic[normalisedUri]}`
      );
      return ssr.nonDynamic[normalisedUri];
    }

    if (html.nonDynamic[normalisedUri]) {
      // log in prod
      console.log(
        `[router] html.nonDynamic matched, uri: ${uri}\n- normalisedUri: ${normalisedUri}\n- result:${html.nonDynamic[normalisedUri]}`
      );
      return html.nonDynamic[normalisedUri];
    }

    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(normalisedUri);

      if (pathMatchesRoute) {
        // log in prod
        console.log(
          `[router] dynamic matched, uri: ${uri}\n- normalisedUri: ${normalisedUri}\n- matched regex: ${re}\n- result:${file}`
        );
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
 * Stale revalidate
 */
interface RevalidationInterface {
  [key: string]: Date;
}

interface RouteConfig {
  initialRevalidateSeconds: number | false;
}

// find first revalidation interval and use it globally
// if not exists, then will be undefined and may be used to detect if revalidation should be turned on
const REVALIDATION_CONFIG = Object.values<RouteConfig>(
  PrerenderManifest.routes
).find((r) => typeof r.initialRevalidateSeconds === "number");

const REVALIDATE_IN = isDevMode()
  ? 1
  : REVALIDATION_CONFIG?.initialRevalidateSeconds || 4;

const REVALIDATIONS: RevalidationInterface = {};

const isStale = (key: string, revalidateIn = REVALIDATE_IN) => {
  debug(`[isStale] revalidateIn: ${revalidateIn}`);

  if (!revalidateIn) {
    return false;
  }

  debug(`[isStale] Now: ${new Date()}`);
  debug(`[isStale] REVALIDATIONS[key] before set: ${REVALIDATIONS[key]}`);

  if (!REVALIDATIONS[key]) {
    setStaleIn(key, revalidateIn);
    return true;
  }

  debug(`[isStale] REVALIDATIONS[key] after set: ${REVALIDATIONS[key]}`);

  debug(
    `[isStale] REVALIDATIONS[key] < new Date(): ${
      REVALIDATIONS[key] < new Date()
    }`
  );

  return REVALIDATIONS[key] < new Date();
};

const setStaleIn = (key: string, seconds: number): void => {
  const revalidateAt = new Date();
  revalidateAt.setSeconds(revalidateAt.getSeconds() + seconds);
  REVALIDATIONS[key] = revalidateAt;
};

const runRevalidation = async (
  event: RevalidationEvent,
  context: Context
): Promise<void> => {
  const functionName = context.functionName.split(".").pop();
  const enc = new TextEncoder();
  const params = {
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: enc.encode(JSON.stringify(event)),
    Qualifier: context.functionVersion
  };
  debug(`[revalidation] invoke: ${JSON.stringify(params)}`);
  const response = await lambda.send(new InvokeCommand(params));
  debug(`[revalidation] invoked, response:${JSON.stringify(response)}`);
  return;
};

const handleRevalidation = async ({
  event,
  manifest,
  prerenderManifest,
  context
}: {
  event: OriginResponseEvent;
  manifest: OriginRequestDefaultHandlerManifest;
  prerenderManifest: PrerenderManifestType;
  context: Context;
}): Promise<void> => {
  debug("[revalidation-function] Processing revalidation...");
  debug(`[revalidation-function] event: ${JSON.stringify(event)}`);
  // const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);
  const canonicalUrl = decodeURI(uri)
    .replace(`${basePath}`, "")
    .replace(`/_next/data/`, "")
    .replace(`${manifest.buildId}/`, "")
    .replace(".json", "")
    .replace(".html", "");

  const htmlKey = `${(basePath || "").replace(/^\//, "")}${
    !basePath ? "" : "/"
  }static-pages/${manifest.buildId}/${decodeURI(canonicalUrl)}.html`;
  const jsonKey = `${(basePath || "").replace(/^\//, "")}${
    !basePath ? "" : "/"
  }_next/data/${manifest.buildId}/${decodeURI(canonicalUrl)}.json`;

  // get heads from s3
  const { domainName, region } = request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");

  debug(`[revalidation-function] normalized uri: ${uri}`);
  debug(`[revalidation-function] canonical key: ${canonicalUrl}`);
  debug(`[revalidation-function] html key: ${htmlKey}`);
  debug(`[revalidation-function] json key: ${jsonKey}`);
  debug(`[revalidation-function] bucket name: ${bucketName}`);

  const s3 = new S3Client({
    // region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });

  const { HeadObjectCommand } = await import(
    "@aws-sdk/client-s3/commands/HeadObjectCommand"
  );
  const getStream = await import("get-stream");

  const htmlHead = await s3.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: htmlKey
    })
  );

  const jsonHead = await s3.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: jsonKey
    })
  );

  debug(`[revalidation-function] html head resp: ${htmlHead}`);
  debug(`[revalidation-function] json head resp: ${jsonHead}`);

  // const bodyString = await getStream.default(Body as Readable);

  // render page

  // calculate etags

  const etag = createETag().update("test").digest();

  debug(`[revalidation-function] etag: ${etag}`);
  // assert both or none etags differ

  // if etags differ:

  // -- put updated files to s3

  // -- invalidate html and json path
  return;
};

export const handler = async (
  event: OriginRequestEvent | OriginResponseEvent | RevalidationEvent,
  context: Context
): Promise<CloudFrontResultResponse | CloudFrontRequest | void> => {
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  let response: CloudFrontResultResponse | CloudFrontRequest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const routesManifest: RoutesManifest = RoutesManifestJson;

  const { now, log } = perfLogger(manifest.logLambdaExecutionTimes);

  const tHandlerBegin = now();

  if (process.env.NODE_ENV !== "development") {
    // https://github.com/serverless-nextjs/serverless-next.js/issues/484#issuecomment-673152792
    // eslint-disable-next-line no-eval
    eval('process.env.NODE_ENV="production"');
  }
  debug(`[handler] node_env: ${process.env.NODE_ENV}`);

  if (!process.env.__NEXT_IMAGE_OPTS) {
    // eslint-disable-next-line no-eval
    eval(
      `process.env.__NEXT_IMAGE_OPTS = ${JSON.stringify({
        path: ImagesManifest.path
      })}`
    );
  }

  // Permanent Static Pages
  if (manifest.permanentStaticPages) {
    const requestUri = event.Records[0].cf.request.uri;
    const uri = requestUri === "/" ? "/index.html" : `${requestUri}.html`;
    if (manifest.permanentStaticPages.includes(uri)) {
      debug(
        `[permanentStaticPages] permanentStaticPages: ${manifest.permanentStaticPages}`
      );
      debug(
        `[permanentStaticPages] requestUri = ${requestUri}, uri = ${uri}, is match`
      );
      return await generatePermanentPageResponse(
        uri,
        manifest,
        event,
        routesManifest
      );
    }
  }

  if (event.revalidate) {
    const { domainName, region } = event.Records[0].cf.request.origin!.s3!;
    const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");

    const renderService = new RenderService(event);
    const s3Service = new S3Service(
      new S3Client({
        region,
        maxAttempts: 3,
        retryStrategy: await buildS3RetryStrategy()
      }),
      { bucketName, domainName, region }
    );
    const cloudfrontService = new CloudFrontService(new CloudFrontClient({}), {
      distributionId: manifest.distributionId
    });

    const handler = new RevalidateHandler(
      resourceService,
      renderService,
      s3Service,
      cloudfrontService
    );
    await handler.run(event, context, manifest);
    return;
  }

  if (isOriginResponse(event)) {
    debug(`[handle-origin-response] event: ${JSON.stringify(event)}`);
    response = await handleOriginResponse({
      event,
      manifest,
      prerenderManifest,
      context
    });
  } else {
    debug(`[handle-origin-request] event: ${JSON.stringify(event)}`);
    response = await handleOriginRequest({
      event,
      manifest,
      prerenderManifest,
      routesManifest,
      context
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

  debug(`[origin] final response: ${JSON.stringify(response)}`);

  return response;
};

/**
 * check if this url and query params need to rewrite. And rewrite it if get configuration form serverless.yml
 * Now, we can only support 1 url params, like rewrite /index.html?page=[number] to /page/[number].html
 * We can use querystring lib if we want to support more functions.
 *
 * For example,
 *     urlRewrites:
 *        - name: paginationRewrite
 *          originUrl: /index.html?page=[number]
 *          rewriteUrl: /page/[number].html
 *
 * @param manifest
 * @param request
 */
const checkAndRewriteUrl = (
  manifest: OriginRequestDefaultHandlerManifest,
  request: CloudFrontRequest
): void => {
  debug(`[checkAndRewriteUrl] manifest: ${JSON.stringify(manifest)}`);
  const rewrites = manifest.urlRewrites;
  debug(`[checkAndRewriteUrl] rewriteList: ${JSON.stringify(rewrites)}`);

  if (!rewrites || rewrites.length === 0) return;

  debug(`[checkAndRewriteUrl] Before: ${request.uri}, ${request.querystring}`);

  const requestParamName = request.querystring.split("=")[0];
  const requestParamValue = request.querystring.split("=")[1];
  const requestUri = request.uri.split(".")[0];
  if (!requestParamName || !requestParamValue || !requestUri) return;

  debug(
    `[checkAndRewriteUrl] requestParamName: ${requestParamName}, requestParamValue: ${requestParamValue}，requestUri: ${requestUri}`
  );
  rewrites.forEach(({ originUrl, rewriteUrl }) => {
    debug(
      `[originUrl: ${originUrl}, rewriteUrl: ${rewriteUrl}, prefix: ${requestUri}?${requestParamName}= ]`
    );
    if (originUrl.startsWith(`${requestUri}?${requestParamName}=`)) {
      request.uri = `${rewriteUrl.split("[")[0]}${requestParamValue}.html`;
      request.querystring = "";
    }
  });

  debug(`[checkAndRewriteUrl] After: ${request.uri}, ${request.querystring}`);
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
  context?: Context;
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
  const { pages, publicFiles, canonicalHostname } = manifest;

  const isPublicFile = publicFiles[decodedUri];
  const isDataReq = isDataRequest(uri);

  // Handle redirects
  // TODO: refactor redirect logic to another file since this is getting quite large

  const hostHeader = request.headers.host[0]?.value || "";

  if (
    canonicalHostname &&
    hostHeader &&
    !isDataReq &&
    !isPublicFile &&
    hostHeader !== canonicalHostname
  ) {
    return createRedirectResponse(
      `https://${canonicalHostname}${request.uri}`,
      request.querystring,
      301
    );
  }

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
      if (isExternalRewrite(customRewrite)) {
        const { req, res, responsePromise } = lambdaAtEdgeCompat(
          event.Records[0].cf,
          {
            enableHTTPCompression: manifest.enableHTTPCompression
          }
        );
        await createExternalRewriteResponse(customRewrite, req, res);
        return await responsePromise;
      }

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

      uri = normaliseUri(request.uri);
    }
  }

  const isStaticPage = pages.html.nonDynamic[uri]; // plain page without any props
  const isPrerenderedPage = prerenderManifest.routes[decodedUri]; // prerendered pages are also static pages like "pages.html" above, but are defined in the prerender-manifest
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
      const pageName = uri === "/" ? "/index" : uri;
      request.uri = `${pageName}.html`;
      checkAndRewriteUrl(manifest, request);
      debug(`[origin-request] is html of fallback, uri: ${request.uri}`);
    } else if (isDataReq) {
      // We need to check whether data request is unmatched i.e routed to 404.html or _error.js
      const normalisedDataRequestUri = normaliseDataRequestUri(uri, manifest);
      const pagePath = router(manifest)(normalisedDataRequestUri);
      debug(`[origin-request] is json, uri: ${request.uri}`);
      if (pagePath === "pages/404.html") {
        // Request static 404 page from s3
        s3Origin.path = `${basePath}/static-pages/${manifest.buildId}`;
        request.uri = pagePath.replace("pages", "");
        debug(`[origin-request] is 404, uri: ${request.uri}`);
      } else if (
        pagePath === "pages/_error.js" ||
        (!prerenderManifest.routes[normalisedDataRequestUri] &&
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

  debug(
    `[origin-request] [ssr] start ssr for uri: uri: ${request.uri}, pagePath: ${pagePath}`
  );

  if (pagePath.endsWith(".html") && !isPreviewRequest) {
    s3Origin.path = `${basePath}/static-pages/${manifest.buildId}`;
    request.uri = pagePath.replace("pages", "");
    addS3HostHeader(request, normalisedS3DomainName);

    debug(`[origin-request] [ssr] html response: ${JSON.stringify(request)}`);

    return request;
  }

  const tBeforePageRequire = now();
  let page = require(`./${pagePath}`); // eslint-disable-line
  const tAfterPageRequire = now();

  log("require JS execution time", tBeforePageRequire, tAfterPageRequire);

  const tBeforeSSR = now();
  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression,
      rewrittenUri
    }
  );

  // Preview data is not usable in preview api:
  // Token bypass can not be used due to Next preview data size limit
  // https://github.com/vercel/next.js/issues/19685
  // So we set auth token to preview data before SSR.
  if (isPreviewRequest) {
    setJerryAuth(
      request,
      req,
      prerenderManifest.preview.previewModeSigningKey,
      prerenderManifest.preview.previewModeEncryptionKey
    );
  }

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

      debug(`[origin-request] [ssr] json response: ${JSON.stringify(res)}`);

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

  // We want data to be real time when previewing.
  if (isPreviewRequest) {
    setCacheControlToNoCache(response);
  }

  return response;
};

const handleOriginResponse = async ({
  event,
  manifest,
  prerenderManifest,
  context
}: {
  event: OriginResponseEvent;
  manifest: OriginRequestDefaultHandlerManifest;
  prerenderManifest: PrerenderManifestType;
  context: Context;
}) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;

  debug(`[origin-request]: ${JSON.stringify(request)}`);

  const { status } = response;
  const uri = normaliseUri(request.uri, true);
  const hasFallback = hasFallbackForUri(uri, prerenderManifest, manifest);
  const isHTMLPage = prerenderManifest.routes[decodeURI(uri)];
  const isPublicFile = manifest.publicFiles[decodeURI(uri)];
  const isEnforceRevalidationRequest = request.querystring === "enforceISR";
  // if isEnforceRevalidationRequest is true, revalidation will start anyway.

  // For PUT or DELETE just return the response as these should be unsupported S3 methods
  if (request.method === "PUT" || request.method === "DELETE") {
    return response;
  }

  if (status !== "403") {
    debug(`[origin-response] bypass: ${request.uri}`);

    // Set 404 status code for 404.html page. We do not need normalised URI as it will always be "/404.html"
    if (request.uri === "/404.html") {
      response.status = "404";
      response.statusDescription = "Not Found";
    } else {
      const revalidationKey = decodeURI(uri)
        .replace(`_next/data/`, "")
        .replace(`${manifest.buildId}/`, "")
        .replace(".json", "")
        .replace(".html", "");

      debug(`[origin-response] revalidationKey: ${revalidationKey}`);
      debug(`[origin-response] isData: ${isDataRequest(uri)}`);
      debug(`[origin-response] isHtml: ${isHTMLPage}`);
      debug(`[origin-response] isFallback: ${hasFallback}`);

      if (
        isEnforceRevalidationRequest ||
        // if REVALIDATION_CONFIG is undefined revalidation is off
        (REVALIDATION_CONFIG &&
          (isHTMLPage || hasFallback || isDataRequest(uri)) &&
          !isPublicFile &&
          isStale(revalidationKey))
      ) {
        await runRevalidation({ ...event, revalidate: true }, context);
        setStaleIn(revalidationKey, REVALIDATE_IN);
      }
    }

    return response;
  }

  const { domainName, region } = request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");
  const pagePath = router(manifest)(uri);

  const s3 = new S3Client({
    region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });

  /**
   *  Blocking fallback flow
   */
  debug(`[origin-response] has fallback: ${JSON.stringify(hasFallback)}`);
  debug(`[origin-response] pagePath: ${pagePath}`);
  debug(`[origin-response] uri: ${uri}`);
  debug(`[origin-response] isDataRequest: ${isDataRequest(uri)}`);

  if (
    hasFallback &&
    hasFallback.fallback === null &&
    uri.endsWith(".html") &&
    !isDataRequest(uri)
  ) {
    // eslint-disable-next-line
    const page = require(`./${pagePath}`);
    const jsonPath = `${(basePath || "").replace(/^\//, "")}${
      basePath === "" ? "" : "/"
    }_next/data/${manifest.buildId}${decodeURI(uri).replace(".html", ".json")}`;

    const { req, res } = lambdaAtEdgeCompat(event.Records[0].cf, {
      enableHTTPCompression: manifest.enableHTTPCompression,
      rewrittenUri: `/${jsonPath}`
    });

    const isSSG = !!page.getStaticProps;
    const renderedRes = await page.renderReqToHTML(req, res, "passthrough");

    debug(`[blocking-fallback] rendered res: ${JSON.stringify(renderedRes)}`);

    const { renderOpts, html } = renderedRes;

    debug(
      `[blocking-fallback] rendered page, uri: ${uri}, ${
        request.uri
      } pagePath: ${pagePath}, opts: ${JSON.stringify(
        renderOpts
      )}, html: ${JSON.stringify(html)}`
    );

    // Check if it is a `not Found` response. Return 404 in that case.
    if (isNotFoundPage(manifest, html)) {
      debug(`[blocking-fallback] 'not found' response received. Sending 404.`);
      return createNotFoundResponse(
        response,
        basePath,
        manifest,
        s3,
        bucketName
      );
    }

    const pageProps = renderOpts?.pageData?.pageProps;

    // Redirect.
    if (pageProps.__N_REDIRECT) {
      const redirectResp = createRedirectResponse(
        pageProps.__N_REDIRECT,
        request.querystring,
        pageProps.__N_REDIRECT_STATUS
      );

      const location = redirectResp?.headers?.location[0].value || "";

      // Hack around 'read only' header changed error from aws
      response.headers["location"] = [
        {
          key: "Location",
          value: location
        }
      ];

      return {
        ...redirectResp,
        headers: response.headers
      };
    }

    if (isSSG) {
      const s3JsonParams = {
        Bucket: bucketName,
        Key: jsonPath,
        Body: JSON.stringify(renderOpts.pageData),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };
      const s3HtmlParams = {
        Bucket: bucketName,
        Key: `${(basePath || "").replace(/^\//, "")}${
          basePath === "" ? "" : "/"
        }static-pages/${manifest.buildId}${decodeURI(uri)}`,
        Body: html,
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };

      debug(`[blocking-fallback] json to s3: ${JSON.stringify(s3JsonParams)}`);
      debug(`[blocking-fallback] html to s3: ${JSON.stringify(s3HtmlParams)}`);
      await Promise.all([
        s3.send(new PutObjectCommand(s3JsonParams)),
        s3.send(new PutObjectCommand(s3HtmlParams))
      ]);
    }
    const htmlOut = {
      status: "200",
      statusDescription: "OK",
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
            value: "public, max-age=0, s-maxage=2678400, must-revalidate"
          }
        ]
      },
      body: html
    };
    debug(
      `[blocking-fallback] responded with html: ${JSON.stringify(htmlOut)}`
    );
    return htmlOut;
  }

  if (isDataRequest(uri) && !pagePath.endsWith(".html")) {
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

    debug(
      `[origin-response] rendered page, uri: ${uri}, pagePath: ${pagePath}, opts: ${JSON.stringify(
        renderOpts
      )}, html: ${JSON.stringify(html)}`
    );

    if (isSSG) {
      const s3JsonParams = {
        Bucket: bucketName,
        Key: `${(basePath || "").replace(/^\//, "")}${
          basePath === "" ? "" : "/"
        }${decodeURI(uri.replace(/^\//, ""))}`,
        Body: JSON.stringify(renderOpts.pageData),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };
      const s3HtmlParams = {
        Bucket: bucketName,
        Key: `${(basePath || "").replace(/^\//, "")}${
          basePath === "" ? "" : "/"
        }static-pages/${manifest.buildId}/${decodeURI(normaliseUri(request.uri))
          .replace(`/_next/data/`, "")
          .replace(`${manifest.buildId}/`, "")
          .replace(".json", ".html")}`,
        Body: html,
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };

      debug(region);
      debug(bucketName);
      debug(JSON.stringify(s3HtmlParams));
      debug(JSON.stringify(s3JsonParams));

      // const { PutObjectCommand } = await import(
      //   "@aws-sdk/client-s3/commands/PutObjectCommand"
      // );
      await Promise.all([
        s3.send(new PutObjectCommand(s3JsonParams)),
        s3.send(new PutObjectCommand(s3HtmlParams))
      ]);
      debug(`[origin-response] created json: ${JSON.stringify(s3JsonParams)}`);
      debug(`[origin-response] created html: ${JSON.stringify(s3HtmlParams)}`);
    }
    res.writeHead(200, response.headers as any);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(renderOpts.pageData));
    const jsonOut = await responsePromise;
    debug(`[origin-response] responded with json: ${JSON.stringify(jsonOut)}`);
    return jsonOut;
  } else {
    if (!hasFallback) {
      debug(`[origin-response] fallback bypass: ${JSON.stringify(response)}`);
      return response;
    }

    // If route has fallback, return that page from S3, otherwise return 404 page
    const s3Key = `${(basePath || "").replace(/^\//, "")}${
      basePath === "" ? "" : "/"
    }static-pages/${manifest.buildId}${hasFallback.fallback || "/404.html"}`;

    debug(`[origin-response] has fallback: ${JSON.stringify(hasFallback)}`);

    // const { GetObjectCommand } = await import(
    //   "@aws-sdk/client-s3/commands/GetObjectCommand"
    // );
    // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
    const getStream = await import("get-stream");

    const s3Params = {
      Bucket: bucketName,
      Key: s3Key
    };

    const { Body, CacheControl } = await s3.send(
      new GetObjectCommand(s3Params)
    );
    const bodyString = await getStream.default(Body as Readable);

    const out = {
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
    debug(`[origin-response] fallback response: ${JSON.stringify(out)}`);
    return out;
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
    pages: { ssr, html }
  } = manifest;
  // Non-dynamic routes are prioritized over dynamic fallbacks, return false to ensure those get rendered instead
  if (ssr.nonDynamic[uri] || html.nonDynamic[uri]) {
    return false;
  }

  let foundFallback: FoundFallbackInterface | undefined = undefined; // for later use to reduce duplicate work

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
      const matchesFallbackRoute = Object.keys(
        prerenderManifest.dynamicRoutes
      ).find((prerenderManifestRoute) => {
        const fileMatchesPrerenderRoute =
          dynamicRoute.file === `pages${prerenderManifestRoute}.js`;

        if (fileMatchesPrerenderRoute) {
          foundFallback =
            prerenderManifest.dynamicRoutes[prerenderManifestRoute];
        }

        return fileMatchesPrerenderRoute;
      });

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
  return Object.values(prerenderManifest.dynamicRoutes).find((routeConfig) => {
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

// This sets CloudFront response with strict no-cache.
const setCacheControlToNoCache = (response: CloudFrontResultResponse): void => {
  response.headers = {
    ...response.headers,
    "cache-control": [
      {
        key: "Cache-Control",
        value: "public, max-age=0, s-maxage=0, must-revalidate"
      }
    ]
  };
};

// generate Permanent Page Response and add headers
export const generatePermanentPageResponse = async (
  uri: string,
  manifest: OriginRequestDefaultHandlerManifest,
  event: OriginRequestEvent | OriginResponseEvent | RevalidationEvent,
  routesManifest: RoutesManifest
) => {
  const { domainName, region } = event.Records[0].cf.request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");
  const s3 = new S3Client({
    region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });
  debug(
    `[generatePermanentPageResponse] manifest: ${manifest.permanentStaticPages}`
  );
  debug(`[generatePermanentPageResponse] uri: ${uri}`);

  //get page from S3
  const s3Key = `${(basePath || "").replace(/^\//, "")}${
    basePath === "" ? "" : "/"
  }static-pages/${manifest.buildId}${PERMANENT_STATIC_PAGES_DIR}${uri}`;

  const getStream = await import("get-stream");

  const s3Params = {
    Bucket: bucketName,
    Key: s3Key
  };
  debug(
    `[generatePermanentPageResponse] s3Params: ${JSON.stringify(s3Params)}`
  );

  const { Body, $metadata } = await s3.send(new GetObjectCommand(s3Params));
  const bodyString = await getStream.default(Body as Readable);

  debug(
    `[generatePermanentPageResponse] $metadata: ${JSON.stringify($metadata)}`
  );
  const s3Headers = addS3HeadersToResponse($metadata.httpHeaders);

  const out = {
    status: "200",
    statusDescription: "OK",
    headers: {
      ...s3Headers,
      "content-type": [
        {
          key: "Content-Type",
          value: "text/html"
        }
      ],
      "cache-control": [
        {
          key: "Cache-Control",
          value: "public, max-age=0, s-maxage=2678400, must-revalidate"
        }
      ]
    },
    body: bodyString
  };

  addHeadersToResponse(uri, out as CloudFrontResultResponse, routesManifest);

  debug(`[generatePermanentPageResponse]: ${JSON.stringify(out.headers)}`);
  debug(`[generatePermanentPageResponse]: ${JSON.stringify(out.body)}`);
  return out;
};
