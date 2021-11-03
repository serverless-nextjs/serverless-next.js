import { Manifest, Request, RoutesManifest } from "../types";
import { parse } from "cookie";

const resolveHostForHeader = (req: Request, headerName: string) => {
  const hostHeaders = req.headers[headerName];
  /**
   * if hostHeaders is a string means it is resolved as "x-forwarded-host"
   *  "x-forwarded-host": "next-serverless.com"
   *
   * else it is resolved as host
   * [ { key: 'Host', value: 'next-serverless.com' } ]
   **/

  if (typeof hostHeaders === "string" || hostHeaders instanceof String) {
    return hostHeaders;
  }

  if (hostHeaders && hostHeaders.length > 0) {
    return hostHeaders[0].value.split(":")[0];
  }
  return undefined;
};

function resolveHost(req: Request) {
  // When running behind a reverse-proxy the x-forwarded-host is added
  const xForwardedHost = resolveHostForHeader(req, "x-forwarded-host");
  if (xForwardedHost) {
    return xForwardedHost;
  }

  return resolveHostForHeader(req, "host");
}

export const findDomainLocale = (
  req: Request,
  manifest: RoutesManifest
): string | null => {
  const domains = manifest.i18n?.domains;
  if (domains) {
    const host = resolveHost(req);
    if (host) {
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

    // If prefixed with a locale, return that path with normalized locale
    const pathLowerCase = path.toLowerCase();
    for (const locale of locales) {
      if (
        pathLowerCase === `${basePath}/${locale}`.toLowerCase() ||
        pathLowerCase.startsWith(`${basePath}/${locale}/`.toLowerCase())
      ) {
        return path.replace(
          new RegExp(`${basePath}/${locale}`, "i"),
          `${basePath}/${forceLocale ?? locale}`
        );
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
    const pathLowerCase = path.toLowerCase();
    const locales = routesManifest.i18n.locales;

    // If prefixed with a locale, return path without
    for (const locale of locales) {
      const prefixLowerCase = `/${locale.toLowerCase()}`;
      if (pathLowerCase === prefixLowerCase) {
        return "/";
      }
      if (pathLowerCase.startsWith(`${prefixLowerCase}/`)) {
        return `${pathLowerCase.slice(prefixLowerCase.length)}`;
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
    const defaultLocaleLowerCase =
      routesManifest.i18n.defaultLocale?.toLowerCase();
    const localeMap: { [key: string]: string } = {};
    for (const locale of routesManifest.i18n.locales) {
      localeMap[locale.toLowerCase()] = locale;
    }

    // Accept.language(header, locales) prefers the locales order,
    // so we ask for all to find the order preferred by user.
    const Accept = await import("@hapi/accept");
    for (const language of Accept.languages(acceptLanguage)) {
      const localeLowerCase = language.toLowerCase();
      if (localeLowerCase === defaultLocaleLowerCase) {
        break;
      }
      if (localeMap[localeLowerCase]) {
        return `${routesManifest.basePath}/${localeMap[localeLowerCase]}${
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
    const uriLowerCase = uri.toLowerCase();
    for (const locale of routesManifest.i18n.locales) {
      const localeLowerCase = locale.toLowerCase();
      if (
        uriLowerCase === `/${localeLowerCase}` ||
        uriLowerCase.startsWith(`/${localeLowerCase}/`)
      ) {
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

  const host = resolveHost(req);
  if (domains && host) {
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
