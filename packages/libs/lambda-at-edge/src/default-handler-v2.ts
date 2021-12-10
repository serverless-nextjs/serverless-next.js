// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
// @ts-ignore
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestEvent,
  OriginResponseEvent
} from "./types";
import { CloudFrontResultResponse } from "aws-lambda";
import {
  PreRenderedManifest as PrerenderManifestType,
  RoutesManifest,
  defaultHandler
} from "@sls-next/core";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";
import { s3BucketNameFromEventRequest } from "./s3/s3BucketNameFromEventRequest";
import { AwsPlatformClient } from "@sls-next/aws-common";

/**
 * V2 Lambda@Edge handler that wraps the platform-agnostic handler.
 * @param event
 */
export const handler = async (
  event: OriginRequestEvent | OriginResponseEvent
): Promise<CloudFrontResultResponse> => {
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const routesManifest: RoutesManifest = RoutesManifestJson;

  // Compatibility layer required to convert from Node.js req/res <-> CloudFront responses
  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    {
      enableHTTPCompression: manifest.enableHTTPCompression
    }
  );

  // Initialize AWS platform specific client
  const request = event.Records[0].cf.request;
  const bucketName = s3BucketNameFromEventRequest(request) ?? "";
  const { region: bucketRegion } = request.origin?.s3 || {
    region: "us-east-1" // default to us-east-1 though it should always be present
  };
  const regenerationQueueRegion = bucketRegion;
  const regenerationQueueName =
    manifest.regenerationQueueName ?? `${bucketName}.fifo`;
  const awsPlatformClient = new AwsPlatformClient(
    bucketName,
    bucketRegion,
    regenerationQueueName,
    regenerationQueueRegion
  );

  // Handle request with platform-agnostic handler
  await defaultHandler({
    req,
    res,
    responsePromise,
    manifest,
    prerenderManifest,
    routesManifest,
    options: {
      logExecutionTimes: manifest.logLambdaExecutionTimes ?? false
    },
    platformClient: awsPlatformClient
  });

  // Convert to CloudFront compatible response
  const response = await responsePromise;

  // Remove any blacklisted headers from CloudFront response
  if (response.headers) {
    removeBlacklistedHeaders(response.headers);
  }

  return response;
};
