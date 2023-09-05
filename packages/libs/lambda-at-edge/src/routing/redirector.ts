import { compileDestination } from "./matcher";
import {
  OriginRequestApiHandlerManifest,
  OriginRequestDefaultHandlerManifest,
  OriginRequestImageHandlerManifest,
  RedirectData,
  RoutesManifest
} from "../../types";
import * as http from "http";
import { CloudFrontRequest } from "aws-lambda";
import { CloudFrontResultResponse } from "aws-lambda";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import * as queryString from "querystring";
import { isEmpty } from "lodash";

/**
 * Whether this is the default trailing slash redirect.
 * This should only be used during build step to remove unneeded redirect paths.
 * @param redirect
 * @param basePath
 */
export function isTrailingSlashRedirect(
  redirect: RedirectData,
  basePath: string
) {
  if (basePath !== "") {
    return (
      redirect.statusCode === 308 &&
      ((redirect.source === `${basePath}` &&
        redirect.destination === `${basePath}/`) ||
        (redirect.source === `${basePath}/` &&
          redirect.destination === `${basePath}`) ||
        (redirect.source === `${basePath}/:path+/` &&
          redirect.destination === `${basePath}/:path+`) ||
        (redirect.source === `${basePath}/:file((?:[^/]+/)*[^/]+\\.\\w+)/` &&
          redirect.destination === `${basePath}/:file`) ||
        (redirect.source === `${basePath}/:notfile((?:[^/]+/)*[^/\\.]+)` &&
          redirect.destination === `${basePath}/:notfile/`))
    );
  } else {
    return (
      redirect.statusCode === 308 &&
      ((redirect.source === "/:path+/" && redirect.destination === "/:path+") ||
        (redirect.source === "/:path+" &&
          redirect.destination === "/:path+/") ||
        (redirect.source === "/:file((?:[^/]+/)*[^/]+\\.\\w+)/" &&
          redirect.destination === "/:file") ||
        (redirect.source === "/:notfile((?:[^/]+/)*[^/\\.]+)" &&
          redirect.destination === "/:notfile/"))
    );
  }
}

/**
 * Get the redirect of the given path, if it exists. Otherwise return null.
 * @param path
 * @param queryParams
 * @param routesManifest
 */
export function getRedirectPath(
  path: string,
  queryParams: Params,
  routesManifest: RoutesManifest
): { redirectPath: string; statusCode: number } | null {
  const redirects: RedirectData[] = routesManifest.redirects;

  for (const redirect of redirects) {
    const matcher = getPathMatch(redirect.source);

    let params = matcher(path);

    if (redirect.has && params) {
      const hasParams = matchHas(
        {
          headers: {},
          cookies: {}
        } as any,
        redirect.has,
        queryParams
      );

      if (hasParams) {
        Object.assign(params, hasParams);
      } else {
        params = false;
      }
    }
    if (params) {
      const destination = compileDestination(redirect.destination, params);
      if (destination) {
        return {
          redirectPath: destination,
          statusCode: redirect.statusCode
        };
      }
    }
  }

  return null;
}

/**
 * Create a redirect response with the given status code for CloudFront.
 * @param uri
 * @param originalQueryParams
 * @param statusCode
 */
export function createRedirectResponse(
  uri: string,
  originalQueryParams: Params,
  statusCode: number
): CloudFrontResultResponse {
  let location;

  // Properly join query strings
  if (originalQueryParams) {
    const [uriPath, uriQuery] = uri.split("?");
    const uriQueryParams = queryString.parse(uriQuery);

    // overwrite params in original query string if necessary
    const mergedParams = { ...originalQueryParams, ...uriQueryParams };
    location = `${uriPath}${
      isEmpty(mergedParams) ? "" : `?${queryString.stringify(mergedParams)}`
    }`;
  } else {
    location = uri;
  }

  const status = statusCode.toString();
  const statusDescription = http.STATUS_CODES[status];

  const refresh =
    statusCode === 308
      ? [
          // Required for IE11 compatibility
          {
            key: "Refresh",
            value: `0;url=${location}`
          }
        ]
      : [];

  return {
    status: status,
    statusDescription: statusDescription,
    headers: {
      location: [
        {
          key: "Location",
          value: location
        }
      ],
      refresh: refresh
    }
  };
}

/**
 * Get a domain redirect such as redirecting www to non-www domain.
 * @param request
 * @param buildManifest
 */
export function getDomainRedirectPath(
  request: CloudFrontRequest,
  buildManifest:
    | OriginRequestDefaultHandlerManifest
    | OriginRequestApiHandlerManifest
    | OriginRequestImageHandlerManifest
): string | null {
  const hostHeaders = request.headers["host"];
  if (hostHeaders && hostHeaders.length > 0) {
    const host = hostHeaders[0].value;
    const domainRedirects = buildManifest.domainRedirects;

    if (domainRedirects && domainRedirects[host]) {
      return `${domainRedirects[host]}${request.uri}`;
    }
  }
  return null;
}
