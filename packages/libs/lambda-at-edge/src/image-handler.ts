// @ts-ignore
import manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import {
  ImagesManifest,
  OriginRequestEvent,
  OriginRequestImageHandlerManifest,
  RoutesManifest
} from "./types";
import { CloudFrontResultResponse } from "aws-lambda";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import { UrlWithParsedQuery } from "url";
import url from "url";
import { addHeadersToResponse } from "./headers/addHeaders";
import { imageOptimizer } from "./images/imageOptimizer";
import {
  createRedirectResponse,
  getDomainRedirectPath
} from "./routing/redirector";
import { getUnauthenticatedResponse } from "./auth/authenticator";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";

const basePath = RoutesManifestJson.basePath;

const normaliseUri = (uri: string): string => {
  if (uri.startsWith(basePath)) {
    uri = uri.slice(basePath.length);
  }

  return uri;
};

const isImageOptimizerRequest = (uri: string): boolean =>
  uri.startsWith("/_next/image");

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request;
  const routesManifest: RoutesManifest = RoutesManifestJson;
  const buildManifest: OriginRequestImageHandlerManifest = manifest;

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
  const domainRedirect = getDomainRedirectPath(request, buildManifest);
  if (domainRedirect) {
    return createRedirectResponse(domainRedirect, request.querystring, 308);
  }

  // No other redirects or rewrites supported for now as it's assumed one is accessing this directly.
  // But it can be added later.

  const uri = normaliseUri(request.uri);

  // Handle image optimizer requests
  const isImageRequest = isImageOptimizerRequest(uri);
  if (isImageRequest) {
    let imagesManifest: ImagesManifest | undefined;

    try {
      // @ts-ignore
      imagesManifest = await import("./images-manifest.json");
    } catch (error) {
      console.warn(
        "Images manifest not found for image optimizer request. Image optimizer will fallback to defaults."
      );
    }

    const { req, res, responsePromise } = lambdaAtEdgeCompat(
      event.Records[0].cf,
      {
        enableHTTPCompression: manifest.enableHTTPCompression
      }
    );

    const urlWithParsedQuery: UrlWithParsedQuery = url.parse(
      `${request.uri}?${request.querystring}`,
      true
    );

    const { domainName, region } = request.origin!.s3!;
    const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, "");

    await imageOptimizer(
      { basePath: basePath, bucketName: bucketName, region: region },
      imagesManifest,
      req,
      res,
      urlWithParsedQuery
    );

    const response = await responsePromise;

    addHeadersToResponse(request.uri, response, routesManifest);

    if (response.headers) {
      removeBlacklistedHeaders(response.headers);
    }

    return response;
  } else {
    return {
      status: "404"
    };
  }
};
