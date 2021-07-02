// @ts-ignore
import manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import cloudFrontCompat from "@sls-next/next-aws-cloudfront";
import {
  OriginRequestApiHandlerManifest,
  OriginRequestEvent,
  RoutesManifest
} from "./types";
import { CloudFrontResultResponse } from "aws-lambda";
import { createExternalRewriteResponse } from "./routing/rewriter";
import { handleApi } from "@sls-next/core";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request;
  const routesManifest: RoutesManifest = RoutesManifestJson;
  const buildManifest: OriginRequestApiHandlerManifest = manifest;
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf, {
    enableHTTPCompression: buildManifest.enableHTTPCompression
  });

  const external = await handleApi(
    { req, res, responsePromise },
    buildManifest,
    routesManifest,
    (pagePath: string) => require(`./${pagePath}`)
  );

  if (external) {
    const { path } = external;
    await createExternalRewriteResponse(path, req, res, request.body?.data);
  }

  const response = await responsePromise;

  if (response.headers) {
    removeBlacklistedHeaders(response.headers);
  }

  return response;
};
