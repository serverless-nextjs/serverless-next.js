import { BuildOptions, DynamicPageKeyValue, NextConfig } from "./types";
import {
  ApiManifest,
  DynamicSSG,
  Manifest,
  NonDynamicSSG,
  PageManifest,
  RoutesManifest
} from "../types";
import { isDynamicRoute, isOptionalCatchAllRoute } from "./isDynamicRoute";
import { normaliseDomainRedirects } from "./normaliseDomainRedirects";
import { pathToRegexStr } from "./pathToRegexStr";
import { PrerenderManifest } from "next/dist/build";
import { getSortedRoutes } from "./sortedRoutes";
import { addDefaultLocaleToPath } from "../route/locale";
import { usedSSR } from "./ssr";

export const prepareBuildManifests = async (
  buildOptions: BuildOptions,
  nextConfig: NextConfig | undefined,
  routesManifest: RoutesManifest,
  pagesManifest: { [key: string]: string },
  prerenderManifest: PrerenderManifest,
  publicFiles: string[]
): Promise<{
  pageManifest: PageManifest;
  apiManifest: ApiManifest;
  imageManifest: Manifest;
}> => {
  const {
    authentication,
    buildId,
    domainRedirects: unnormalisedDomainRedirects
  } = buildOptions;
  const domainRedirects = normaliseDomainRedirects(unnormalisedDomainRedirects);

  const pageManifest: PageManifest = {
    buildId,
    pages: {
      dynamic: [],
      ssr: {
        dynamic: {},
        nonDynamic: {}
      },
      html: {
        dynamic: {},
        nonDynamic: {}
      },
      ssg: {
        dynamic: {},
        nonDynamic: {}
      }
    },
    publicFiles: {},
    trailingSlash: nextConfig?.trailingSlash ?? false,
    domainRedirects,
    authentication
  };

  const apiManifest: ApiManifest = {
    apis: {
      dynamic: [],
      nonDynamic: {}
    },
    domainRedirects,
    authentication
  };

  const allSsrPages = pageManifest.pages.ssr;
  const ssgPages = pageManifest.pages.ssg;
  const htmlPages = pageManifest.pages.html;
  const apiPages = apiManifest.apis;
  const dynamicApi: DynamicPageKeyValue = {};

  const isHtmlPage = (path: string): boolean => path.endsWith(".html");
  const isApiPage = (path: string): boolean => path.startsWith("pages/api");

  Object.entries(pagesManifest).forEach(([route, pageFile]) => {
    // Check for optional catch all dynamic routes vs. other types of dynamic routes
    // We also add another route without dynamic parameter for optional catch all dynamic routes
    const isOptionalCatchAllDynamicRoute = isOptionalCatchAllRoute(route);
    const isOtherDynamicRoute =
      !isOptionalCatchAllDynamicRoute && isDynamicRoute(route);

    // The base path of optional catch-all without parameter
    const optionalBaseRoute = isOptionalCatchAllDynamicRoute
      ? route.split("/[[")[0] || "/"
      : "";

    if (isHtmlPage(pageFile)) {
      if (isOtherDynamicRoute) {
        htmlPages.dynamic[route] = pageFile;
      } else if (isOptionalCatchAllDynamicRoute) {
        htmlPages.dynamic[route] = pageFile;
        htmlPages.nonDynamic[optionalBaseRoute] = pageFile;
      } else {
        htmlPages.nonDynamic[route] = pageFile;
      }
    } else if (isApiPage(pageFile)) {
      if (isOtherDynamicRoute) {
        dynamicApi[route] = {
          file: pageFile,
          regex: pathToRegexStr(route)
        };
      } else if (isOptionalCatchAllDynamicRoute) {
        dynamicApi[route] = {
          file: pageFile,
          regex: pathToRegexStr(route)
        };
        apiPages.nonDynamic[optionalBaseRoute] = pageFile;
      } else {
        apiPages.nonDynamic[route] = pageFile;
      }
    } else if (isOtherDynamicRoute) {
      allSsrPages.dynamic[route] = pageFile;
    } else if (isOptionalCatchAllDynamicRoute) {
      allSsrPages.dynamic[route] = pageFile;
      allSsrPages.nonDynamic[optionalBaseRoute] = pageFile;
    } else {
      allSsrPages.nonDynamic[route] = pageFile;
    }
  });

  // Add non-dynamic SSG routes
  Object.entries(prerenderManifest.routes).forEach(([route, ssgRoute]) => {
    const { initialRevalidateSeconds, srcRoute } = ssgRoute;
    // Next.js generates prerender manifest with default locale prefixed, normalize it
    // This is somewhat wrong, but used in other build logic.
    // Prerendered dynamic routes (with srcRoute) are left as they are
    const defaultLocale = routesManifest.i18n?.defaultLocale;
    if (defaultLocale && !ssgRoute.srcRoute) {
      const normalizedRoute = route.replace(`/${defaultLocale}/`, "/");
      ssgPages.nonDynamic[normalizedRoute] = {
        initialRevalidateSeconds,
        srcRoute
      };
    } else {
      ssgPages.nonDynamic[route] = {
        initialRevalidateSeconds,
        srcRoute
      };
    }
  });

  // Add dynamic SSG routes
  Object.entries(prerenderManifest.dynamicRoutes ?? {}).forEach(
    ([route, dynamicSsgRoute]) => {
      const { fallback } = dynamicSsgRoute;
      ssgPages.dynamic[route] = {
        fallback
      };
    }
  );

  // Include only SSR routes that are in runtime use
  const ssrPages = (pageManifest.pages.ssr = usedSSR(
    pageManifest,
    routesManifest,
    apiPages.dynamic.length > 0 || Object.keys(apiPages.nonDynamic).length > 0
  ));

  // Duplicate routes for all specified locales. This is easy matching locale-prefixed routes in handler
  if (routesManifest.i18n) {
    const localeHtmlPages: {
      dynamic: {
        [key: string]: string;
      };
      nonDynamic: {
        [key: string]: string;
      };
    } = {
      dynamic: {},
      nonDynamic: {}
    };

    const localeSsgPages: {
      dynamic: {
        [key: string]: DynamicSSG;
      };
      nonDynamic: {
        [key: string]: NonDynamicSSG;
      };
    } = {
      dynamic: {},
      nonDynamic: {}
    };

    const localeSsrPages: {
      dynamic: {
        [key: string]: string;
      };
      nonDynamic: {
        [key: string]: string;
      };
    } = {
      dynamic: {},
      nonDynamic: {}
    };

    for (const locale of routesManifest.i18n.locales) {
      htmlPagesNonDynamicLoop: for (const key in htmlPages.nonDynamic) {
        // Locale-prefixed pages don't need to be duplicated
        for (const locale of routesManifest.i18n.locales) {
          if (key.startsWith(`/${locale}/`) || key === `/${locale}`) {
            break htmlPagesNonDynamicLoop;
          }
        }

        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;
        localeHtmlPages.nonDynamic[newKey] = htmlPages.nonDynamic[key].replace(
          "pages/",
          `pages/${locale}/`
        );
      }

      for (const key in htmlPages.dynamic) {
        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;
        localeHtmlPages.dynamic[newKey] = htmlPages.dynamic[key].replace(
          "pages/",
          `pages/${locale}/`
        );
      }

      for (const key in ssrPages.nonDynamic) {
        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;
        localeSsrPages.nonDynamic[newKey] = ssrPages.nonDynamic[key];
      }

      for (const key in ssrPages.dynamic) {
        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;

        // Page stays the same
        localeSsrPages.dynamic[newKey] = ssrPages.dynamic[key];
      }

      for (const key in ssgPages.nonDynamic) {
        if (ssgPages.nonDynamic[key].srcRoute) {
          // These are already correctly localized
          continue;
        }

        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;

        // Initial default value
        localeSsgPages.nonDynamic[newKey] = { ...ssgPages.nonDynamic[key] };
      }

      for (const key in ssgPages.dynamic) {
        const newKey = key === "/" ? `/${locale}` : `/${locale}${key}`;
        localeSsgPages.dynamic[newKey] = { ...ssgPages.dynamic[key] };

        const newDynamicSsgRoute = localeSsgPages.dynamic[newKey];

        // Replace with localized values
        newDynamicSsgRoute.fallback =
          typeof newDynamicSsgRoute.fallback === "string"
            ? newDynamicSsgRoute.fallback.replace("/", `/${locale}/`)
            : newDynamicSsgRoute.fallback;
      }
    }

    pageManifest.pages.ssr = {
      dynamic: {
        ...ssrPages.dynamic,
        ...localeSsrPages.dynamic
      },
      nonDynamic: {
        ...ssrPages.nonDynamic,
        ...localeSsrPages.nonDynamic
      }
    };

    pageManifest.pages.ssg = {
      nonDynamic: {
        ...ssgPages.nonDynamic,
        ...localeSsgPages.nonDynamic
      },
      dynamic: {
        ...ssgPages.dynamic,
        ...localeSsgPages.dynamic
      }
    };

    pageManifest.pages.html = {
      nonDynamic: {
        ...htmlPages.nonDynamic,
        ...localeHtmlPages.nonDynamic
      },
      dynamic: {
        ...htmlPages.dynamic,
        ...localeHtmlPages.dynamic
      }
    };
  }

  // Sort page routes
  const dynamicRoutes = Object.keys(pageManifest.pages.html.dynamic)
    .concat(Object.keys(pageManifest.pages.ssg.dynamic))
    .concat(Object.keys(pageManifest.pages.ssr.dynamic));
  const sortedRoutes = getSortedRoutes(dynamicRoutes);
  pageManifest.pages.dynamic = sortedRoutes.map((route) => {
    return {
      route: route,
      regex: pathToRegexStr(route)
    };
  });

  // Sort api routes
  const sortedApi = getSortedRoutes(Object.keys(dynamicApi));
  apiManifest.apis.dynamic = sortedApi.map((route) => {
    return {
      file: dynamicApi[route].file,
      regex: pathToRegexStr(route)
    };
  });

  // Public files
  const files: { [key: string]: string } = {};
  publicFiles.forEach((file) => {
    files[`/${file}`] = file;
  });
  pageManifest.publicFiles = files;

  // Image manifest
  const imageManifest: Manifest = {
    authentication,
    domainRedirects: domainRedirects
  };

  return {
    pageManifest,
    apiManifest,
    imageManifest
  };
};

export * from "./types";
