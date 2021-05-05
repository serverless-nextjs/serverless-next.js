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
import {
  createExternalRewriteResponse,
  getRewritePath,
  isExternalRewrite
} from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";
import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import {
  handleAuth,
  handleCustomRedirects,
  handleDomainRedirects
} from "@sls-next/core";
import { removeLocalePrefixFromUri } from "./routing/locale-utils";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";

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

  // Basic authentication

  const authRoute = handleAuth(request, buildManifest);
  if (authRoute) {
    const { isUnauthorized, status, ...response } = authRoute;
    return { ...response, status: status.toString() };
  }

  // Redirects

  const redirectRoute =
    handleDomainRedirects(request, buildManifest) ||
    handleCustomRedirects(request, routesManifest);
  if (redirectRoute) {
    const { isRedirect, status, ...response } = redirectRoute;
    return { ...response, status: status.toString() };
  }

  // Handle custom rewrites but not for non-dynamic routes
  let isNonDynamicRoute =
    buildManifest.apis.nonDynamic[normaliseUri(request.uri)];

  let uri = normaliseUri(request.uri);
  uri = removeLocalePrefixFromUri(uri, routesManifest);

  if (!isNonDynamicRoute) {
    const customRewrite = getRewritePath(
      request.uri,
      routesManifest,
      router(manifest),
      uri
    );
    if (customRewrite) {
      const [customRewriteUriPath, customRewriteUriQuery] = customRewrite.split(
        "?"
      );

      if (request.querystring) {
        request.querystring = `${request.querystring}${
          customRewriteUriQuery ? `&${customRewriteUriQuery}` : ""
        }`;
      } else {
        request.querystring = `${customRewriteUriQuery ?? ""}`;
      }

      if (isExternalRewrite(customRewrite)) {
        const { req, res, responsePromise } = lambdaAtEdgeCompat(
          event.Records[0].cf,
          {
            enableHTTPCompression: manifest.enableHTTPCompression
          }
        );
        await createExternalRewriteResponse(
          customRewriteUriPath +
            (request.querystring ? "?" : "") +
            request.querystring,
          req,
          res,
          request.body?.data
        );
        return await responsePromise;
      }

      request.uri = customRewriteUriPath;
      uri = normaliseUri(request.uri);
      uri = removeLocalePrefixFromUri(uri, routesManifest);
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

  page.default(req, res);

  const response = await responsePromise;

  // Add custom headers before returning response
  addHeadersToResponse(request.uri, response, routesManifest);

  if (response.headers) {
    removeBlacklistedHeaders(response.headers);
  }

  return response;
};
