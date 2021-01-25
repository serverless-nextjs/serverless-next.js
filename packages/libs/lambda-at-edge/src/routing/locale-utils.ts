import { RoutesManifest } from "../types";

export function addDefaultLocaleToPath(
  path: string,
  routesManifest: RoutesManifest
): string {
  if (routesManifest.i18n) {
    const defaultLocale = routesManifest.i18n.defaultLocale;
    const locales = routesManifest.i18n.locales;
    const basePath = routesManifest.basePath;

    // If prefixed with a locale, return that path
    for (const locale of locales) {
      if (
        path === `${routesManifest.basePath}/${locale}` ||
        path.startsWith(`${routesManifest.basePath}/${locale}/`)
      ) {
        return path;
      }
    }

    // Otherwise, prefix with default locale
    if (path === "/" || path === `${basePath}`) {
      return `${basePath}/${defaultLocale}`;
    } else {
      return path.replace(`${basePath}/`, `${basePath}/${defaultLocale}/`);
    }
  }

  return path;
}

export function isLocaleIndexUri(
  normalisedUri: string,
  routesManifest: RoutesManifest
) {
  if (routesManifest.i18n) {
    for (const locale of routesManifest.i18n.locales) {
      if (normalisedUri === `/${locale}`) {
        return true;
      }
    }
  }

  return false;
}
