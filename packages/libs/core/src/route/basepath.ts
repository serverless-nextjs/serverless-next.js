import { RoutesManifest } from "../types";

export const normalise = (
  uri: string,
  routesManifest: RoutesManifest
): { normalisedUri: string; missingExpectedBasePath: boolean } => {
  const { basePath } = routesManifest;
  if (basePath) {
    if (uri.startsWith(basePath)) {
      uri = uri.slice(basePath.length);
    } else {
      // basePath set but URI does not start with basePath, return original path with special flag indicating missing expected base path
      // but basePath is expected
      return { normalisedUri: uri, missingExpectedBasePath: true };
    }
  }

  // Remove trailing slash for all paths
  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  // Empty path should be normalised to "/" as there is no Next.js route for ""
  return {
    normalisedUri: uri === "" ? "/" : uri,
    missingExpectedBasePath: false
  };
};
