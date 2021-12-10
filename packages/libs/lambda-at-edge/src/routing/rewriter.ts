import { IncomingMessage, ServerResponse } from "http";
import { OriginRequestEvent } from "../types";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import { CloudFrontResultResponse } from "aws-lambda";

// Blacklisted or read-only headers in CloudFront
const ignoredHeaders = [
  "connection",
  "expect",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "trailer",
  "upgrade",
  "x-accel-buffering",
  "x-accel-charset",
  "x-accel-limit-rate",
  "x-accel-redirect",
  "x-cache",
  "x-forwarded-proto",
  "x-real-ip",
  "content-length",
  "host",
  "transfer-encoding",
  "via"
];

const ignoredHeaderPrefixes = ["x-amz-cf-", "x-amzn-", "x-edge-"];

function isIgnoredHeader(name: string): boolean {
  const lowerCaseName = name.toLowerCase();

  for (const prefix of ignoredHeaderPrefixes) {
    if (lowerCaseName.startsWith(prefix)) {
      return true;
    }
  }

  return ignoredHeaders.includes(lowerCaseName);
}

export async function createExternalRewriteResponse(
  customRewrite: string,
  req: IncomingMessage,
  res: ServerResponse,
  body?: string
): Promise<void> {
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
    if (!isIgnoredHeader(name)) {
      res.setHeader(name, val);
    }
  }
  res.statusCode = fetchResponse.status;
  res.end(await fetchResponse.buffer());
}

export const externalRewrite: (
  event: OriginRequestEvent,
  enableHTTPCompression: boolean | undefined,
  rewrite: string
) => Promise<CloudFrontResultResponse> = async (
  event: OriginRequestEvent,
  enableHTTPCompression: boolean | undefined,
  rewrite: string
) => {
  const request = event.Records[0].cf.request;
  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression
    }
  );
  await createExternalRewriteResponse(
    rewrite + (request.querystring ? "?" : "") + request.querystring,
    req,
    res,
    request.body?.data
  );
  return await responsePromise;
};
