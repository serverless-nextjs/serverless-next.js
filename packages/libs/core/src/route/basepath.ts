import { RoutesManifest } from "../types";

export const normalise = (
  uri: string,
  routesManifest: RoutesManifest
): string => {
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
