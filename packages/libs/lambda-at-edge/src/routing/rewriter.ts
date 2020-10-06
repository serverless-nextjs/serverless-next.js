import { compileDestination, matchPath } from "./matcher";
import { RewriteData, RoutesManifest } from "../../types";

/**
 * Get the rewrite of the given path, if it exists. Otherwise return null.
 * @param path
 * @param routesManifest
 */
export function getRewritePath(
  path: string,
  routesManifest: RoutesManifest
): string | null {
  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const match = matchPath(path, rewrite.source);

    if (match) {
      return compileDestination(rewrite.destination, match.params);
    }
  }

  return null;
}
