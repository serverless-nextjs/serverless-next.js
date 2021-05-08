import { compileDestination, matchPath } from "./match";
import { RewriteData, RoutesManifest } from "./types";
import { addDefaultLocaleToPath, isLocalePrefixedUri } from "./locale";

/**
 * Get the rewrite of the given path, if it exists. Otherwise return null.
 * @param path
 * @param routesManifest
 * @param router
 * @param normalisedPath
 */
export function getRewritePath(
  uri: string,
  routesManifest: RoutesManifest
): string | null {
  const path = addDefaultLocaleToPath(uri, routesManifest);

  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const match = matchPath(path, rewrite.source);

    if (match) {
      let destination = compileDestination(rewrite.destination, match.params);

      // Pass params to destination for locale rewrites
      // Except nextInternalLocale param since it's already in path prefix
      if (destination && isLocalePrefixedUri(path, routesManifest)) {
        const querystring = Object.keys(match.params)
          .filter((key) => key !== "nextInternalLocale")
          // @ts-ignore
          .map((key) => {
            // @ts-ignore
            const param = match.params[key];
            if (typeof param === "string") {
              return `${key}=${param}`;
            } else {
              return param.map((val: string) => `${key}=${val}`).join("&");
            }
          })
          .filter((key) => key)
          .join("&");

        if (querystring) {
          destination += destination.includes("?")
            ? `&${querystring}`
            : `?${querystring}`;
        }
      }

      return destination;
    }
  }

  return null;
}

export function isExternalRewrite(customRewrite: string): boolean {
  return (
    customRewrite.startsWith("http://") || customRewrite.startsWith("https://")
  );
}
