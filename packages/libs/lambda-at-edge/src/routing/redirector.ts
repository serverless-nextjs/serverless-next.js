import { compileDestination, matchPath } from "./matcher";
import { RedirectData, RoutesManifest } from "../../types";
import * as http from "http";

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
 * @param routesManifest
 */
export function getRedirectPath(
  path: string,
  routesManifest: RoutesManifest
): { redirectPath: string; statusCode: number } | null {
  const redirects: RedirectData[] = routesManifest.redirects;

  for (const redirect of redirects) {
    const match = matchPath(path, redirect.source);

    if (match) {
      return {
        redirectPath: compileDestination(redirect.destination, match.params),
        statusCode: redirect.statusCode
      };
    }
  }

  return null;
}

/**
 * Create a redirect response with the given status code for CloudFront.
 * @param uri
 * @param querystring
 * @param statusCode
 */
export function createRedirectResponse(
  uri: string,
  querystring: string,
  statusCode: number
) {
  const location = querystring ? `${uri}?${querystring}` : uri;

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
