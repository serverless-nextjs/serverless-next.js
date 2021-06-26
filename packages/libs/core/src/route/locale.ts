import { Manifest, Request, RoutesManifest } from "../types";
import { IncomingMessage } from "http";
import { parse } from "cookie";

export const findDomainLocale = (
  req: IncomingMessage,
  manifest: RoutesManifest
): string | null => {
  const domains = manifest.i18n?.domains;
  if (domains) {
    const hostHeaders = req.headers.host?.split(",");
    if (hostHeaders && hostHeaders.length > 0) {
      const host = hostHeaders[0];
      const matchedDomain = domains.find((d) => d.domain === host);

      if (matchedDomain) {
        return matchedDomain.defaultLocale;
      }
    }
  }
  return null;
};

export function addDefaultLocaleToPath(
  path: string,
  routesManifest: RoutesManifest,
  forceLocale: string | null = null
): string {
  if (routesManifest.i18n) {
    const defaultLocale = forceLocale ?? routesManifest.i18n.defaultLocale;

    const locales = routesManifest.i18n.locales;
    const basePath = path.startsWith(routesManifest.basePath)
      ? routesManifest.basePath
      : "";

    // If prefixed with a locale, return that path
    for (const locale of locales) {
      if (
        path === `${basePath}/${locale}` ||
        path.startsWith(`${basePath}/${locale}/`)
      ) {
        return typeof forceLocale === "string"
          ? path.replace(`${locale}/`, `${forceLocale}/`)
          : path;
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

export function dropLocaleFromPath(
  path: string,
  routesManifest: RoutesManifest
): string {
  if (routesManifest.i18n) {
    const locales = routesManifest.i18n.locales;

    // If prefixed with a locale, return path without
    for (const locale of locales) {
      const prefix = `/${locale}`;
      if (path === prefix) {
        return "/";
      }
      if (path.startsWith(`${prefix}/`)) {
        return `${path.slice(prefix.length)}`;
      }
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
    const defaultLocale = routesManifest.i18n.defaultLocale?.toLowerCase();
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

export function getLocalePrefixFromUri(
  uri: string,
  routesManifest: RoutesManifest
) {
  if (routesManifest.basePath && uri.startsWith(routesManifest.basePath)) {
    uri = uri.slice(routesManifest.basePath.length);
  }

  if (routesManifest.i18n) {
    for (const locale of routesManifest.i18n.locales) {
      if (uri === `/${locale}` || uri.startsWith(`/${locale}/`)) {
        return `/${locale}`;
      }
    }
    return `/${routesManifest.i18n.defaultLocale}`;
  }

  return "";
}

/**
 * Get a redirect to the locale-specific domain. Returns undefined if no redirect found.
 * @param req
 * @param routesManifest
 */
export async function getLocaleDomainRedirect(
  req: Request,
  routesManifest: RoutesManifest
): Promise<string | undefined> {
  // Redirect to correct domain based on user's language
  const domains = routesManifest.i18n?.domains;
  const hostHeaders = req.headers.host;
  if (domains && hostHeaders && hostHeaders.length > 0) {
    const host = hostHeaders[0].value.split(":")[0];
    const languageHeader = req.headers["accept-language"];
    const acceptLanguage = languageHeader && languageHeader[0]?.value;

    const headerCookies = req.headers.cookie
      ? req.headers.cookie[0]?.value
      : undefined;
    // Use cookies first, otherwise use the accept-language header
    let acceptLanguages: string[] = [];
    let nextLocale;
    if (headerCookies) {
      const cookies = parse(headerCookies);
      nextLocale = cookies["NEXT_LOCALE"];
    }

    if (nextLocale) {
      acceptLanguages = [nextLocale.toLowerCase()];
    } else {
      const Accept = await import("@hapi/accept");
      acceptLanguages = Accept.languages(acceptLanguage).map((lang) =>
        lang.toLowerCase()
      );
    }

    // Try to find the right domain to redirect to if needed
    // First check current domain can support any preferred language, if so do not redirect
    const currentDomainData = domains.find(
      (domainData) => domainData.domain === host
    );

    if (currentDomainData) {
      for (const language of acceptLanguages) {
        if (
          currentDomainData.defaultLocale?.toLowerCase() === language ||
          currentDomainData.locales
            ?.map((locale) => locale.toLowerCase())
            .includes(language)
        ) {
          return undefined;
        }
      }
    }

    // Try to find domain whose default locale matched preferred language in order
    for (const language of acceptLanguages) {
      for (const domainData of domains) {
        if (domainData.defaultLocale.toLowerCase() === language) {
          return `${domainData.domain}${req.uri}`;
        }
      }
    }

    // Try to find domain whose supported locales matches preferred language in order
    for (const language of acceptLanguages) {
      for (const domainData of domains) {
        if (
          domainData.locales
            ?.map((locale) => locale.toLowerCase())
            .includes(language)
        ) {
          return `${domainData.domain}${req.uri}`;
        }
      }
    }
  }

  return undefined;
}
