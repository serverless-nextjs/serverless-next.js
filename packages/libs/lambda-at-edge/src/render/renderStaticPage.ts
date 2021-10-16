import {
  getCustomHeaders,
  getStaticRegenerationResponse,
  getThrottledStaticRegenerationCachePolicy,
  handleFallback,
  Route,
  RoutesManifest,
  StaticRoute
} from "@sls-next/core";
import { CloudFrontRequest, CloudFrontResultResponse } from "aws-lambda";
import { OriginRequestDefaultHandlerManifest } from "../types";
import { Readable } from "stream";
import { triggerStaticRegeneration } from "../lib/triggerStaticRegeneration";
import { s3StorePage } from "../s3/s3StorePage";
import { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "http";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * This function is experimental to allow rendering static pages fully from the handler.
 * It uses a client such as S3 client to retrieve the page.
 */
export const renderStaticPage = async ({
  route,
  request,
  req,
  res,
  responsePromise,
  manifest,
  routesManifest,
  bucketName,
  s3Key,
  s3Uri,
  basePath
}: {
  route: Route;
  request: CloudFrontRequest; // eventually we want to make this agnostic to CloudFront
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<CloudFrontResultResponse>;
  manifest: OriginRequestDefaultHandlerManifest;
  routesManifest: RoutesManifest;
  bucketName: string;
  s3Key: string;
  s3Uri: string;
  basePath: string;
}): Promise<CloudFrontResultResponse> => {
  const staticRoute = route.isStatic ? (route as StaticRoute) : undefined;
  const statusCode = route?.statusCode ?? 200;

  // For PUT, DELETE, PATCH, POST, OPTIONS just return a 405 response as these are unsupported S3 methods
  // when using CloudFront S3 origin to return the page, so we keep it in parity.
  // TODO: now that we are directly calling S3 in the origin request handler,
  //  we could implement OPTIONS method as well.
  if (
    request.method === "PUT" ||
    request.method === "DELETE" ||
    request.method === "PATCH" ||
    request.method === "POST" ||
    request.method === "OPTIONS"
  ) {
    res.writeHead(405);
    res.end();
    return await responsePromise;
  }

  // Render response from S3
  const s3 = new S3Client({
    region: request.origin?.s3?.region,
    maxAttempts: 3
  });
  const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";
  // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
  const getStream = await import("get-stream");
  const s3Params = {
    Bucket: bucketName,
    Key: s3Key
  };

  let s3StatusCode;
  let bodyString;
  let s3Response;

  try {
    s3Response = await s3.send(new GetObjectCommand(s3Params));
    bodyString = await getStream.default(s3Response.Body as Readable);
    s3StatusCode = s3Response.$metadata.httpStatusCode;
  } catch (e: any) {
    s3StatusCode = e.$metadata.httpStatusCode;
  }

  // These statuses are returned when S3 does not have access to the page.
  // 404 will also be returned if CloudFront has permissions to list objects.
  if (s3Response && s3StatusCode !== 403 && s3StatusCode !== 404) {
    let cacheControl = s3Response.CacheControl;

    // If these are error pages, then just return them
    if (statusCode === 404 || statusCode === 500) {
      cacheControl =
        statusCode === 500
          ? "public, max-age=0, s-maxage=0, must-revalidate"
          : cacheControl;
    } else {
      // Otherwise we may need to do static regeneration
      const staticRegenerationResponse = getStaticRegenerationResponse({
        expiresHeader: s3Response.Expires?.toString() ?? "",
        lastModifiedHeader: s3Response.LastModified?.toString() ?? "",
        initialRevalidateSeconds: staticRoute?.revalidate
      });

      if (staticRegenerationResponse) {
        cacheControl = staticRegenerationResponse.cacheControl;

        if (
          staticRoute?.page &&
          staticRegenerationResponse.secondsRemainingUntilRevalidation === 0
        ) {
          const regenerationQueueName =
            manifest.regenerationQueueName ?? `${bucketName}.fifo`; // if queue name not specified, we used [bucketName].fifo as used in deployment

          if (!regenerationQueueName) {
            throw new Error("Regeneration queue name is undefined.");
          }

          const { throttle } = await triggerStaticRegeneration({
            basePath,
            request,
            pageS3Path: s3Key,
            eTag: s3Response.ETag,
            lastModified: s3Response.LastModified?.getTime().toString(),
            pagePath: staticRoute.page,
            queueName: regenerationQueueName
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
    const customHeaders = getCustomHeaders(request.uri, routesManifest);
    const convertedCustomHeaders: { [key: string]: string } = {};
    for (const key in customHeaders) {
      convertedCustomHeaders[key] = customHeaders[key][0].value;
    }

    const headers: OutgoingHttpHeaders = {
      "Cache-Control": cacheControl,
      "Content-Disposition": s3Response.ContentDisposition,
      "Content-Type": s3Response.ContentType,
      "Content-Language": s3Response.ContentLanguage,
      "Content-Length": s3Response.ContentLength,
      "Content-Encoding": s3Response.ContentEncoding,
      "Content-Range": s3Response.ContentRange,
      ETag: s3Response.ETag,
      LastModified: s3Response.LastModified?.getTime().toString(),
      "Accept-Ranges": s3Response.AcceptRanges,
      ...convertedCustomHeaders
    };

    res.writeHead(statusCode, headers);
    res.end(bodyString);
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
    const s3Key = `${s3BasePath}static-pages/${manifest.buildId}${file}`;

    const s3Params = {
      Bucket: bucketName,
      Key: s3Key
    };

    const s3Response = await s3.send(new GetObjectCommand(s3Params));
    const bodyString = await getStream.default(s3Response.Body as Readable);

    const statusCode = fallbackRoute.statusCode || 200;
    const is500 = statusCode === 500;

    const cacheControl = is500
      ? "public, max-age=0, s-maxage=0, must-revalidate" // static 500 page should never be cached
      : s3Response.CacheControl ??
        (fallbackRoute.fallback // Use cache-control from S3 response if possible, otherwise use defaults
          ? "public, max-age=0, s-maxage=0, must-revalidate" // fallback should never be cached
          : "public, max-age=0, s-maxage=2678400, must-revalidate");

    res.writeHead(statusCode, {
      "Cache-Control": cacheControl,
      "Content-Type": "text/html"
    });
    res.end(bodyString);
    return await responsePromise;
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
