import { RedirectData } from "types";

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
