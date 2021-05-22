import { addDefaultLocaleToPath } from "./locale";
import { compileDestination, matchPath } from "../match";
import { RewriteData, RoutesManifest } from "../types";

/**
 * Get the rewrite of the given path, if it exists.
 * @param path
 * @param routesManifest
 */
export function getRewritePath(
  uri: string,
  routesManifest: RoutesManifest
): string | undefined {
  const path = addDefaultLocaleToPath(uri, routesManifest);

  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const match = matchPath(path, rewrite.source);
    if (!match) {
      continue;
    }

    const params = match.params as { [key: string]: string | string[] };
    const destination = compileDestination(rewrite.destination, params);
    if (!destination) {
      return;
    }

    // Pass unused params to destination
    // except nextInternalLocale param since it's already in path prefix
    const querystring = Object.keys(params)
      .filter((key) => key !== "nextInternalLocale")
      .filter(
        (key) =>
          !rewrite.destination.endsWith(`:${key}`) &&
          !rewrite.destination.includes(`:${key}/`)
      )
      .map((key) => {
        const param = params[key];
        if (typeof param === "string") {
          return `${key}=${param}`;
        } else {
          return param.map((val: string) => `${key}=${val}`).join("&");
        }
      })
      .filter((key) => key)
      .join("&");

    if (querystring) {
      const separator = destination.includes("?") ? "&" : "?";
      return `${destination}${separator}${querystring}`;
    }

    return destination;
  }
}

export function isExternalRewrite(customRewrite: string): boolean {
  return (
    customRewrite.startsWith("http://") || customRewrite.startsWith("https://")
  );
}
