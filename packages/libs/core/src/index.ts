import { getUnauthenticatedResponse } from "./auth";
import { normalise } from "./basepath";
import { handleDataReq } from "./data";
import { handlePageReq } from "./page";
import { isValidPreviewRequest } from "./preview";
import {
  createRedirectResponse,
  getDomainRedirectPath,
  getLanguageRedirectPath,
  getRedirectPath,
  getTrailingSlashPath
} from "./redirect";
import {
  Manifest,
  PrerenderManifest,
  RedirectRoute,
  Request,
  Route,
  RoutesManifest,
  UnauthorizedRoute
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

const handleLanguageRedirect = async (
  req: Request,
  manifest: Manifest,
  routesManifest: RoutesManifest
): Promise<RedirectRoute | undefined> => {
  const languageRedirectUri = await getLanguageRedirectPath(
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
      file: uri
    };
  }
};

const handleTrailingSlash = (
  req: Request,
  manifest: Manifest,
  isFile: boolean
): Route | undefined => {
  const path = getTrailingSlashPath(req, manifest, isFile);
  if (path) {
    return createRedirectResponse(path, req.querystring, 308);
  }
};

/*
 * Routes:
 * - auth
 * - redirects
 * - public files
 * - data routes
 * - pages
 */
export const routeDefault = async (
  req: Request,
  manifest: Manifest,
  prerenderManifest: PrerenderManifest,
  routesManifest: RoutesManifest
): Promise<Route> => {
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

  if (publicFile) {
    return publicFile;
  }

  const otherRedirect =
    handleCustomRedirects(req, routesManifest) ||
    (await handleLanguageRedirect(req, manifest, routesManifest));
  if (otherRedirect) {
    return otherRedirect;
  }

  const isPreview = await isValidPreviewRequest(
    req.headers.cookie,
    prerenderManifest.preview.previewModeSigningKey
  );

  if (isDataReq) {
    return handleDataReq(uri, manifest, isPreview);
  } else {
    return handlePageReq(req.uri, manifest, routesManifest, isPreview);
  }
};

export * from "./types";
