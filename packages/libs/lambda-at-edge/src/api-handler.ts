// @ts-ignore
import manifest from "./manifest.json";
// @ts-ignore
import RoutesManifestJson from "./routes-manifest.json";
import cloudFrontCompat from "@getjerry/next-aws-cloudfront";
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
import {
  createExternalRewriteResponse,
  getRewritePath,
  isExternalRewrite
} from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";
import { getUnauthenticatedResponse } from "./auth/authenticator";
import lambdaAtEdgeCompat from "@getjerry/next-aws-cloudfront";

const basePath = RoutesManifestJson.basePath;

const normaliseUri = (uri: string): string => {
  if (uri.startsWith(basePath)) {
    uri = uri.slice(basePath.length);
  }

  return uri;
};

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

  // Handle custom redirects
  const customRedirect = getRedirectPath(request.uri, routesManifest);
  if (customRedirect) {
    return createRedirectResponse(
      customRedirect.redirectPath,
      request.querystring,
      customRedirect.statusCode
    );
  }

  // Handle custom rewrites but not for non-dynamic routes
  const isNonDynamicRoute =
    buildManifest.apis.nonDynamic[normaliseUri(request.uri)];

  let uri = normaliseUri(request.uri);

  if (!isNonDynamicRoute) {
    const customRewrite = getRewritePath(
      request.uri,
      routesManifest,
      router(manifest),
      uri
    );
    if (customRewrite) {
      if (isExternalRewrite(customRewrite)) {
        const { req, res, responsePromise } = lambdaAtEdgeCompat(
          event.Records[0].cf,
          {
            enableHTTPCompression: manifest.enableHTTPCompression
          }
        );
        await createExternalRewriteResponse(customRewrite, req, res);
        return await responsePromise;
      }

      request.uri = customRewrite;
      uri = normaliseUri(request.uri);
    }
  }

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

  // Change introduced in Next 12.0.9, causing null pointer error
  // reference: https://github.com/serverless-nextjs/serverless-next.js/pull/2344/files
  if (!req.hasOwnProperty("originalRequest")) {
    Object.defineProperty(req, "originalRequest", {
      get: () => req
    });
  }
  if (!res.hasOwnProperty("originalResponse")) {
    Object.defineProperty(res, "originalResponse", {
      get: () => res
    });
  }

  page.default(req, res);

  const response = await responsePromise;

  // Add custom headers before returning response
  addHeadersToResponse(request.uri, response, routesManifest);

  return response;
};
