// @ts-ignore
import manifest from "./manifest.json";
import cloudFrontCompat from "next-aws-cloudfront";
import { OriginRequestApiHandlerManifest, OriginRequestEvent } from "./types";
import { CloudFrontResultResponse, CloudFrontRequest } from "aws-lambda";

const normaliseUri = (uri: string): string => (uri === "/" ? "/index" : uri);

const router = (
  manifest: OriginRequestApiHandlerManifest
): ((path: string) => string) => {
  const {
    apis: { dynamic, nonDynamic }
  } = manifest;

  return (path: string): string => {
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

    return "pages/_error.js";
  };
};

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);

  const pagePath = router(manifest)(uri);

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);

  page.default(req, res);

  return responsePromise;
};
