import { compileDestination, matchPath } from "./matcher";
import { RewriteData, RoutesManifest } from "../../types";

/**
 * Get the rewrite of the given path, if it exists. Otherwise return null.
 * @param path
 * @param routesManifest
 * @param router
 * @param normalisedPath
 */
export function getRewritePath(
  path: string,
  routesManifest: RoutesManifest,
  router: (uri: string) => string | null,
  normalisedPath: string
): string | null {
  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const match = matchPath(path, rewrite.source);

    if (match) {
      const destination = compileDestination(rewrite.destination, match.params);

      // No-op rewrite support: skip to next rewrite if path does not map to existing non-dynamic and dynamic routes
      if (path === destination) {
        const url = router(normalisedPath);

        if (url === "pages/404.html" || url === "pages/_error.js") {
          continue;
        }
      }

      return destination;
    }
  }

  return null;
}
