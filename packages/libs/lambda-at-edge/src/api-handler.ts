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
import { CloudFrontResultResponse } from "aws-lambda";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getRedirectPath
} from "./routing/redirector";
import { getRewritePath } from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";

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
): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request;
  const routesManifest: RoutesManifest = RoutesManifestJson;
  const buildManifest: OriginRequestApiHandlerManifest = manifest;

  // Handle domain redirects e.g www to non-www domain
  const domainRedirect = getDomainRedirectPath(request, buildManifest);
  if (domainRedirect) {
    return createRedirectResponse(domainRedirect, request.querystring, 308);
  }

  // Handle custom redirects
  const customRedirect = getRedirectPath(request.uri, routesManifest);
  if (customRedirect) {
    return createRedirectResponse(
      customRedirect.redirectPath,
      request.querystring,
      customRedirect.statusCode
    );
  }

  // Handle custom rewrites
  const customRewrite = getRewritePath(request.uri, routesManifest);
  if (customRewrite) {
    request.uri = customRewrite;
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
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf, {
    enableHTTPCompression: buildManifest.enableHTTPCompression
  });

  page.default(req, res);

  const response = await responsePromise;

  // Add custom headers before returning response
  addHeadersToResponse(request.uri, response, routesManifest);

  return response;
};
