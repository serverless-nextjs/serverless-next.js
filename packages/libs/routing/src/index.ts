import { getUnauthenticatedResponse } from "./auth";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getLanguageRedirectPath,
  getRedirectPath,
  getTrailingSlashPath
} from "./redirect";
import { Manifest, Request, Response, RoutesManifest } from "./types";

export const handleAuth = (
  req: Request,
  manifest: Manifest
): Response | undefined => {
  const { headers } = req;
  const unauthenticated = getUnauthenticatedResponse(
    headers.authorization,
    manifest.authentication
  );
  if (unauthenticated) {
    return unauthenticated;
  }
};

export const handleCustomRedirects = (
  req: Request,
  routesManifest: RoutesManifest
): Response | undefined => {
  const redirect = getRedirectPath(req, routesManifest);
  if (redirect) {
    const { path, statusCode } = redirect;
    return createRedirectResponse(path, req.querystring, statusCode);
  }
};

export const handleDomainRedirects = (
  req: Request,
  manifest: Manifest
): Response | undefined => {
  const path = getDomainRedirectPath(req, manifest);
  if (path) {
    return createRedirectResponse(path, req.querystring, 308);
  }
};

export const handleLanguageRedirect = (
  req: Request,
  manifest: Manifest,
  routesManifest: RoutesManifest
): Response | undefined => {
  const languageRedirectUri = getLanguageRedirectPath(
    req,
    manifest,
    routesManifest
  );

  if (languageRedirectUri) {
    return createRedirectResponse(languageRedirectUri, req.querystring, 307);
  }
};

export const handleTrailingSlash = (
  req: Request,
  manifest: Manifest,
  isFile: boolean
): Response | undefined => {
  const path = getTrailingSlashPath(req, manifest, isFile);
  if (path) {
    return createRedirectResponse(path, req.querystring, 308);
  }
};

export * from "./types";
