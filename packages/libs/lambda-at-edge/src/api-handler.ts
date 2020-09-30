// @ts-ignore
import manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import cloudFrontCompat from "@sls-next/next-aws-cloudfront";
import {
  OriginRequestApiHandlerManifest,
  OriginRequestEvent,
  RoutesManifest
} from "../types";
import { CloudFrontResultResponse, CloudFrontRequest } from "aws-lambda";
import { createRedirectResponse, getRedirectPath } from "./routing/redirector";

const basePath = RoutesManifestJson.basePath;

const normaliseUri = (uri: string): string => (uri === "/" ? "/index" : uri);

const router = (
  manifest: OriginRequestApiHandlerManifest
): ((path: string) => string | null) => {
  const {
    apis: { dynamic, nonDynamic }
  } = manifest;

  return (path: string): string | null => {
    if (basePath && path.startsWith(basePath))
      path = path.slice(basePath.length);

    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    for (const route in dynamic) {
      const { file, regex } = dynamic[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    return null;
  };
};

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request;
  const routesManifest: RoutesManifest = RoutesManifestJson;

  // Handle custom redirects
  const customRedirect = getRedirectPath(request.uri, routesManifest);
  if (customRedirect) {
    return createRedirectResponse(
      customRedirect.redirectPath,
      request.querystring,
      customRedirect.statusCode
    );
  }

  const uri = normaliseUri(request.uri);

  const pagePath = router(manifest)(uri);

  if (!pagePath) {
    return {
      status: "404"
    };
  }

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);

  page.default(req, res);

  return responsePromise;
};
