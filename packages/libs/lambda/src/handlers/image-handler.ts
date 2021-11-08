// @ts-ignore
import LambdaManifestJson from "./lambda-manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import { AwsPlatformClient } from "@sls-next/aws-common";
import { httpCompat } from "src/compat/apigw";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from "aws-lambda";
import { ImagesManifest, setCustomHeaders } from "@sls-next/core/dist/module";
import url, { UrlWithParsedQuery } from "url";
import { LambdaManifest, RoutesManifest } from "src/types";
import { imageOptimizer } from "@sls-next/core/dist/module/images";

const basePath = RoutesManifestJson.basePath;

const normaliseUri = (uri: string): string => {
  if (uri.startsWith(basePath)) {
    uri = uri.slice(basePath.length);
  }

  return uri;
};

const isImageOptimizerRequest = (uri: string): boolean =>
  uri.startsWith("/_next/image");

/**
 * Entry point for Lambda image handling.
 * @param event
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  // Compatibility layer required to convert from Node.js req/res <-> API Gateway
  const { req, res, responsePromise } = httpCompat(event);

  const uri = normaliseUri(req.url ?? "");

  // Handle image optimizer requests
  // TODO: probably can move these to core package
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

    const urlWithParsedQuery: UrlWithParsedQuery = url.parse(
      req.url ?? "",
      true
    );

    const lambdaManifest: LambdaManifest = LambdaManifestJson;

    const awsPlatformClient = new AwsPlatformClient(
      lambdaManifest.bucketName,
      lambdaManifest.bucketRegion,
      undefined,
      undefined
    );

    await imageOptimizer(
      basePath,
      imagesManifest,
      req,
      res,
      urlWithParsedQuery,
      awsPlatformClient
    );

    const routesManifest: RoutesManifest = RoutesManifestJson;

    setCustomHeaders({ res, req, responsePromise }, routesManifest);
  } else {
    // TODO: probably move this into the platform-agnostic handler
    res.writeHead(404);
    res.end();
  }

  return await responsePromise;
};
