import { compileDestination, matchPath } from "./matcher";
import {
  OriginRequestApiHandlerManifest,
  OriginRequestDefaultHandlerManifest,
  OriginRequestImageHandlerManifest,
  RedirectData,
  RoutesManifest
} from "../types";
import * as http from "http";
import { CloudFrontRequest } from "aws-lambda";
import { CloudFrontResultResponse } from "aws-lambda";
import { addDefaultLocaleToPath } from "./locale-utils";
import Accept from "@hapi/accept";

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
  // Remove internal trailing slash redirects (in Next.js 10.0.4 and up)
  if (redirect.internal === true) {
    return true;
  }

  if (basePath !== "") {
    return (
      (redirect.statusCode === 308 &&
        ((redirect.source === `${basePath}` &&
          redirect.destination === `${basePath}/`) ||
          (redirect.source === `${basePath}/` &&
            redirect.destination === `${basePath}`) ||
          (redirect.source === `${basePath}/:path+/` &&
            redirect.destination === `${basePath}/:path+`) ||
          (redirect.source === `${basePath}/:file((?:[^/]+/)*[^/]+\\.\\w+)/` &&
            redirect.destination === `${basePath}/:file`) ||
          (redirect.source === `${basePath}/:notfile((?:[^/]+/)*[^/\\.]+)` &&
            redirect.destination === `${basePath}/:notfile/`))) ||
      (redirect.source ===
        `${basePath}/:file((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/]+\\.\\w+)/` &&
        redirect.destination === `${basePath}/:file`) ||
      (redirect.source ===
        `${basePath}/:notfile((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/\\.]+)` &&
        redirect.destination === `${basePath}/:notfile/`)
    );
  } else {
    return (
      (redirect.statusCode === 308 &&
        ((redirect.source === "/:path+/" &&
          redirect.destination === "/:path+") ||
          (redirect.source === "/:path+" &&
            redirect.destination === "/:path+/") ||
          (redirect.source === "/:file((?:[^/]+/)*[^/]+\\.\\w+)/" &&
            redirect.destination === "/:file") ||
          (redirect.source === "/:notfile((?:[^/]+/)*[^/\\.]+)" &&
            redirect.destination === "/:notfile/"))) ||
      (redirect.source ===
        "/:file((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/]+\\.\\w+)/" &&
        redirect.destination === "/:file") ||
      (redirect.source ===
        "/:notfile((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/\\.]+)" &&
        redirect.destination === "/:notfile/")
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
  path = addDefaultLocaleToPath(path, routesManifest);

  const redirects: RedirectData[] = routesManifest.redirects;

  for (const redirect of redirects) {
    const match = matchPath(path, redirect.source);

    if (match) {
      const compiledDestination = compileDestination(
        redirect.destination,
        match.params
      );

      if (!compiledDestination) {
        return null;
      }

      return {
        redirectPath: compiledDestination,
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
): CloudFrontResultResponse {
  let location;

  // Properly join query strings
  if (querystring) {
    const [uriPath, uriQuery] = uri.split("?");
    location = `${uriPath}?${querystring}${uriQuery ? `&${uriQuery}` : ""}`;
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

export function getLanguageRedirect(
  acceptLanguageHeader: string | undefined,
  normalisedUri: string,
  routesManifest: RoutesManifest,
  manifest: OriginRequestDefaultHandlerManifest
): string | undefined {
  // Only redirect root page and if accept language is defined
  if (normalisedUri !== "/" || !acceptLanguageHeader) {
    return undefined;
  }

  if (routesManifest.i18n) {
    const locales = routesManifest.i18n.locales;
    const defaultLocale = routesManifest.i18n.defaultLocale;
    const basePath = routesManifest.basePath;

    const preferredLanguage = Accept.language(acceptLanguageHeader);

    let localeToUse = undefined;

    // Find language in locale that matches preferred language
    for (const locale of locales) {
      if (preferredLanguage.toLowerCase() === locale.toLowerCase()) {
        localeToUse = locale;
        break;
      }
    }

    if (!localeToUse || localeToUse === defaultLocale) {
      return undefined;
    } else {
      return `${basePath}/${localeToUse}${manifest.trailingSlash ? "/" : ""}`;
    }
  }

  return undefined;
}
