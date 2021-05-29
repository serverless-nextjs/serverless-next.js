// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import {
  ExternalRoute,
  handleDefault,
  handleFallback,
  PublicFileRoute,
  routeDefault,
  getCustomHeaders,
  StaticRoute,
  getStaticRegenerationResponse,
  getThrottledStaticRegenerationCachePolicy
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
import { buildS3RetryStrategy } from "./s3/s3RetryStrategy";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";
import { s3BucketNameFromEventRequest } from "./s3/s3BucketNameFromEventRequest";
import { triggerStaticRegeneration } from "./lib/triggerStaticRegeneration";
import { s3StorePage } from "./s3/s3StorePage";

const basePath = RoutesManifestJson.basePath;

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
  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression
    }
  );

  const { now, log } = perfLogger(manifest.logLambdaExecutionTimes);

  let tBeforeSSR = null;
  const getPage = (pagePath: string) => {
    const tBeforePageRequire = now();
    const page = require(`./${pagePath}`); // eslint-disable-line
    const tAfterPageRequire = (tBeforeSSR = now());
    log("require JS execution time", tBeforePageRequire, tAfterPageRequire);
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
    return staticRequest(request, file, `${routesManifest.basePath}/public`);
  }
  if (route.isStatic) {
    const { file, isData } = route as StaticRoute;
    const path = isData
      ? `${routesManifest.basePath}`
      : `${routesManifest.basePath}/static-pages/${manifest.buildId}`;

    // This should not be necessary with static pages,
    // but makes it easier to test rewrites
    const [, querystring] = (req.url ?? "").split("?");
    request.querystring = querystring || "";

    const relativeFile = isData ? file : file.slice("pages".length);
    return staticRequest(request, relativeFile, path);
  }
  const external: ExternalRoute = route;
  const { path } = external;
  return externalRewrite(event, manifest.enableHTTPCompression, path);
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

  const bucketName = s3BucketNameFromEventRequest(request);

  // Reconstruct valid request uri for routing
  const s3Uri = request.uri;
  request.uri = `${basePath}${request.uri.replace(
    /(\.html)?$/,
    manifest.trailingSlash ? "/" : ""
  )}`;
  const route = await routeDefault(
    request,
    manifest,
    prerenderManifest,
    routesManifest
  );
  const staticRoute = route.isStatic ? (route as StaticRoute) : undefined;

  if (response.status !== "403") {
    response.headers = {
      ...response.headers,
      ...getCustomHeaders(request.uri, routesManifest)
    };
    // Set 404 status code for 404.html page. We do not need normalised URI as it will always be "/404.html"
    if (s3Uri.endsWith("/404.html")) {
      response.status = "404";
      response.statusDescription = "Not Found";
      return response;
    }

    // Set 500 status code for 500.html page. We do not need normalised URI as it will always be "/404.html"
    if (s3Uri.endsWith("/500.html")) {
      response.status = "500";
      response.statusDescription = "Internal Server Error";
      response.headers["cache-control"] = [
        {
          key: "Cache-Control",
          value: "public, max-age=0, s-maxage=0, must-revalidate" // server error page should not be cached
        }
      ];
      return response;
    }

    const staticRegenerationResponse = getStaticRegenerationResponse({
      expiresHeader: response.headers?.expires?.[0]?.value || "",
      lastModifiedHeader: response.headers?.["last-modified"]?.[0]?.value || "",
      initialRevalidateSeconds: staticRoute?.revalidate
    });

    if (staticRegenerationResponse) {
      response.headers["cache-control"] = [
        {
          key: "Cache-Control",
          value: staticRegenerationResponse.cacheControl
        }
      ];

      // We don't want the `expires` header to be sent to the client we manage
      // the cache at the edge using the s-maxage directive in the cache-control
      // header
      delete response.headers.expires;

      if (
        staticRoute?.page &&
        staticRegenerationResponse.secondsRemainingUntilRevalidation === 0
      ) {
        const { throttle } = await triggerStaticRegeneration({
          basePath,
          request,
          response,
          pagePath: staticRoute.page
        });

        // Occasionally we will get rate-limited by the Queue (in the event we
        // send it too many messages) and so we we use the cache to reduce
        // requests to the queue for a short period.
        if (throttle) {
          response.headers["cache-control"] = [
            {
              key: "Cache-Control",
              value: getThrottledStaticRegenerationCachePolicy(1).cacheControl
            }
          ];
        }
      }
    }

    return response;
  }

  // For PUT or DELETE just return the response as these should be unsupported S3 methods
  if (request.method === "PUT" || request.method === "DELETE") {
    return response;
  }

  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression
    }
  );

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

  // Lazily import only S3Client to reduce init times until actually needed
  const { S3Client } = await import("@aws-sdk/client-s3/S3Client");

  const s3 = new S3Client({
    region: request.origin?.s3?.region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });
  const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";

  // Either a fallback: true page or a static error page
  if (fallbackRoute.isStatic) {
    const file = fallbackRoute.file.slice("pages".length);
    const s3Key = `${s3BasePath}static-pages/${manifest.buildId}${file}`;
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

    const is404 = file.endsWith("/404.html");
    const is500 = file.endsWith("/500.html");
    return {
      status: is500 ? "500" : is404 ? "404" : "200",
      statusDescription: is500
        ? "Internal Server Error"
        : is404
        ? "Not Found"
        : "OK",
      headers: {
        ...response.headers,
        ...getCustomHeaders(request.uri, routesManifest),
        "content-type": [
          {
            key: "Content-Type",
            value: "text/html"
          }
        ],
        "cache-control": [
          {
            key: "Cache-Control",
            value: is500
              ? "public, max-age=0, s-maxage=0, must-revalidate" // static 500 page should never be cached
              : s3Response.CacheControl ??
                (fallbackRoute.fallback // Use cache-control from S3 response if possible, otherwise use defaults
                  ? "public, max-age=0, s-maxage=0, must-revalidate" // fallback should never be cached
                  : "public, max-age=0, s-maxage=2678400, must-revalidate")
          }
        ]
      },
      body: bodyString
    };
  }

  // This is a fallback route that should be stored in S3 before returning it
  const { renderOpts, html } = fallbackRoute;
  const { expires } = await s3StorePage({
    html,
    uri: s3Uri,
    basePath,
    bucketName: bucketName || "",
    buildId: manifest.buildId,
    pageData: renderOpts.pageData,
    region: request.origin?.s3?.region || "",
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
  const outHeaders: OutgoingHttpHeaders = {};
  Object.entries(response.headers).map(([name, headers]) => {
    outHeaders[name] = headers.map(({ value }) => value);
  });

  res.writeHead(200, outHeaders);
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

const isOriginResponse = (
  event: OriginRequestEvent | OriginResponseEvent
): event is OriginResponseEvent => {
  return event.Records[0].cf.config.eventType === "origin-response";
};
