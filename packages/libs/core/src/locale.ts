import { Manifest, RoutesManifest } from "./types";

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

export const getAcceptLanguageLocale = async (
  acceptLanguage: string,
  manifest: Manifest,
  routesManifest: RoutesManifest
) => {
  if (routesManifest.i18n) {
    const defaultLocale = routesManifest.i18n.defaultLocale;
    const locales = new Set(
      routesManifest.i18n.locales.map((locale) => locale.toLowerCase())
    );

    // Accept.language(header, locales) prefers the locales order,
    // so we ask for all to find the order preferred by user.
    const Accept = await import("@hapi/accept");
    for (const language of Accept.languages(acceptLanguage)) {
      const locale = language.toLowerCase();
      if (locale === defaultLocale) {
        break;
      }
      if (locales.has(locale)) {
        return `${routesManifest.basePath}/${locale}${
          manifest.trailingSlash ? "/" : ""
        }`;
      }
    }
  }
};
