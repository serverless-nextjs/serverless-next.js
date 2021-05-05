import { getUnauthenticatedResponse } from "./auth";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getLanguageRedirectPath,
  getRedirectPath,
  getTrailingSlashPath
} from "./redirect";
import {
  UnauthorizedRoute,
  Manifest,
  RedirectRoute,
  Request,
  Route,
  RoutesManifest
} from "./types";

export const handleAuth = (
  req: Request,
  manifest: Manifest
): UnauthorizedRoute | undefined => {
  const { headers } = req;
  return getUnauthenticatedResponse(
    headers.authorization,
    manifest.authentication
  );
};

export const handleCustomRedirects = (
  req: Request,
  routesManifest: RoutesManifest
): RedirectRoute | undefined => {
  const redirect = getRedirectPath(req, routesManifest);
  if (redirect) {
    const { path, statusCode } = redirect;
    return createRedirectResponse(path, req.querystring, statusCode);
  }
};

export const handleDomainRedirects = (
  req: Request,
  manifest: Manifest
): RedirectRoute | undefined => {
  const path = getDomainRedirectPath(req, manifest);
  if (path) {
    return createRedirectResponse(path, req.querystring, 308);
  }
};

export const handleLanguageRedirect = (
  req: Request,
  manifest: Manifest,
  routesManifest: RoutesManifest
): RedirectRoute | undefined => {
  const languageRedirectUri = getLanguageRedirectPath(
    req,
    manifest,
    routesManifest
  );

  if (languageRedirectUri) {
    return createRedirectResponse(languageRedirectUri, req.querystring, 307);
  }
};

const handlePublicFiles = (
  uri: string,
  manifest: Manifest
): Route | undefined => {
  const decodedUri = decodeURI(uri);
  const isPublicFile = manifest.publicFiles && manifest.publicFiles[decodedUri];
  if (isPublicFile) {
    return {
      isPublicFile: true,
      file: decodedUri
    };
  }
};

export const handleTrailingSlash = (
  req: Request,
  manifest: Manifest,
  isFile: boolean
): Route | undefined => {
  const path = getTrailingSlashPath(req, manifest, isFile);
  if (path) {
    return createRedirectResponse(path, req.querystring, 308);
  }
};

const normalise = (uri: string, routesManifest: RoutesManifest): string => {
  const { basePath, i18n } = routesManifest;
  if (basePath) {
    if (uri.startsWith(basePath)) {
      uri = uri.slice(basePath.length);
    } else {
      // basePath set but URI does not start with basePath, return 404
      if (i18n?.defaultLocale) {
        return `/${i18n.defaultLocale}/404`;
      } else {
        return "/404";
      }
    }
  }

  // Remove trailing slash for all paths
  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  // Empty path should be normalised to "/" as there is no Next.js route for ""
  return uri === "" ? "/" : uri;
};

/*
 * Routes:
 * - auth
 * - redirects
 * - public files
 */
export const routeDefault = (
  req: Request,
  manifest: Manifest,
  routesManifest: RoutesManifest
): Route | undefined => {
  const auth = handleAuth(req, manifest);
  if (auth) {
    return auth;
  }

  const domainRedirect = handleDomainRedirects(req, manifest);
  if (domainRedirect) {
    return domainRedirect;
  }

  const uri = normalise(req.uri, routesManifest);
  const is404 = uri.endsWith("/404");
  const isDataReq = uri.startsWith("/_next/data");
  const publicFile = handlePublicFiles(uri, manifest);
  const isPublicFile = !!publicFile;

  const trailingSlash =
    !is404 && handleTrailingSlash(req, manifest, isDataReq || isPublicFile);
  if (trailingSlash) {
    return trailingSlash;
  }

  return (
    publicFile ||
    handleCustomRedirects(req, routesManifest) ||
    handleLanguageRedirect(req, manifest, routesManifest)
  );
};

export * from "./types";
