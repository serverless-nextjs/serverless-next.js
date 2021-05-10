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
import { externalRewrite } from "./routing/rewriter";
import { addHeadersToResponse } from "./headers/addHeaders";
import {
  ApiRoute,
  ExternalRoute,
  RedirectRoute,
  routeApi,
  UnauthorizedRoute
} from "@sls-next/core";
import { removeBlacklistedHeaders } from "./headers/removeBlacklistedHeaders";

const renderApi = async (
  event: OriginRequestEvent,
  buildManifest: OriginRequestApiHandlerManifest,
  routesManifest: RoutesManifest,
  pagePath: string
) => {
  const request = event.Records[0].cf.request;
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

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request;
  const routesManifest: RoutesManifest = RoutesManifestJson;
  const buildManifest: OriginRequestApiHandlerManifest = manifest;

  const route = routeApi(request, buildManifest, routesManifest);
  if (!route) {
    return {
      status: "404"
    };
  }
  if (route.querystring) {
    request.querystring = `${
      request.querystring ? request.querystring + "&" : ""
    }${route.querystring}`;
  }
  if (route.isApi) {
    const { page } = route as ApiRoute;
    return renderApi(event, manifest, routesManifest, page);
  }
  if (route.isExternal) {
    const { path } = route as ExternalRoute;
    return externalRewrite(event, manifest.enableHTTPCompression, path);
  }
  if (route.isRedirect) {
    const { isRedirect, status, ...response } = route as RedirectRoute;
    return { ...response, status: status.toString() };
  }
  // No if lets typescript check this is the only option
  const unauthorized: UnauthorizedRoute = route;
  const { isUnauthorized, status, ...response } = unauthorized;
  return { ...response, status: status.toString() };
};
