import { normalise } from "./basepath";
import {
  addDefaultLocaleToPath,
  dropLocaleFromPath,
  findDomainLocale
} from "./locale";
import { matchDynamicRoute } from "../match";
import { notFoundPage } from "./notfound";
import { getRewritePath, isExternalRewrite } from "./rewrite";
import {
  ExternalRoute,
  PageManifest,
  PageRoute,
  RoutesManifest,
  Request,
  ApiRoute
} from "../types";

const pageHtml = (localeUri: string) => {
  if (localeUri == "/") {
    return "pages/index.html";
  }
  return `pages${localeUri}.html`;
};

export const handlePageReq = (
  req: Request,
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  isPreview: boolean,
  isRewrite?: boolean
): ExternalRoute | PageRoute | ApiRoute => {
  const { pages } = manifest;
  const { normalisedUri: localeUri, missingExpectedBasePath } = normalise(
    addDefaultLocaleToPath(
      uri,
      routesManifest,
      findDomainLocale(req, routesManifest)
    ),
    routesManifest
  );

  // This allows matching against rewrites even without basepath
  if (!missingExpectedBasePath) {
    if (pages.html.nonDynamic[localeUri]) {
      const nonLocaleUri = dropLocaleFromPath(localeUri, routesManifest);
      const statusCode =
        nonLocaleUri === "/404"
          ? 404
          : nonLocaleUri === "/500"
          ? 500
          : undefined;
      return {
        isData: false,
        isStatic: true,
        file: pages.html.nonDynamic[localeUri],
        statusCode
      };
    }
    if (pages.ssg.nonDynamic[localeUri] && !isPreview) {
      const ssg = pages.ssg.nonDynamic[localeUri];
      const route = ssg.srcRoute ?? localeUri;
      const nonLocaleUri = dropLocaleFromPath(localeUri, routesManifest);
      const statusCode =
        nonLocaleUri === "/404"
          ? 404
          : nonLocaleUri === "/500"
          ? 500
          : undefined;
      return {
        isData: false,
        isStatic: true,
        file: pageHtml(localeUri),
        // page JS path is from SSR entries in manifest
        page: pages.ssr.nonDynamic[route] || pages.ssr.dynamic[route],
        revalidate: ssg.initialRevalidateSeconds,
        statusCode
      };
    }
    // Handle ISR pages with encoded URL
    // This only applies to ISR, other pages should not be resolved if sent with encoded characters (same as local Next.js server behavior)
    const decodedLocaleUri = decodeURI(localeUri);
    if (pages.ssg.nonDynamic[decodedLocaleUri] && !isPreview) {
      const ssg = pages.ssg.nonDynamic[decodedLocaleUri];
      if (ssg.initialRevalidateSeconds) {
        const route = ssg.srcRoute ?? decodedLocaleUri;
        const nonLocaleUri = dropLocaleFromPath(
          decodedLocaleUri,
          routesManifest
        );
        const statusCode =
          nonLocaleUri === "/404"
            ? 404
            : nonLocaleUri === "/500"
            ? 500
            : undefined;
        return {
          isData: false,
          isStatic: true,
          file: pageHtml(localeUri), // Use encoded localeUri instead of decodedLocaleUri as this is used by CloudFront request that needs an encoded URL
          // page JS path is from SSR entries in manifest
          page: pages.ssr.nonDynamic[route] || pages.ssr.dynamic[route],
          revalidate: ssg.initialRevalidateSeconds,
          statusCode
        };
      }
    }
    if ((pages.ssg.notFound ?? {})[localeUri] && !isPreview) {
      return notFoundPage(uri, manifest, routesManifest);
    }
    if (pages.ssr.nonDynamic[localeUri]) {
      if (localeUri.startsWith("/api/")) {
        return {
          isApi: true,
          page: pages.ssr.nonDynamic[localeUri]
        };
      } else {
        return {
          isData: false,
          isRender: true,
          page: pages.ssr.nonDynamic[localeUri]
        };
      }
    }
  }

  const rewrite =
    !isRewrite && getRewritePath(req, uri, routesManifest, manifest);
  if (rewrite) {
    const [path, querystring] = rewrite.split("?");
    if (isExternalRewrite(path)) {
      return {
        isExternal: true,
        path,
        querystring
      };
    }
    const route = handlePageReq(
      req,
      path,
      manifest,
      routesManifest,
      isPreview,
      true
    );
    return {
      ...route,
      querystring
    };
  }

  // We don't want to match URIs with missing basepath against dynamic routes if it wasn't already covered by rewrite.
  if (!missingExpectedBasePath) {
    const dynamic = matchDynamicRoute(localeUri, pages.dynamic);

    const dynamicSSG = dynamic && pages.ssg.dynamic[dynamic];
    if (dynamicSSG && !isPreview) {
      return {
        isData: false,
        isStatic: true,
        file: pageHtml(localeUri),
        page: dynamic ? pages.ssr.dynamic[dynamic] : undefined, // page JS path is from SSR entries in manifest
        fallback: dynamicSSG.fallback
      };
    }
    const dynamicSSR = dynamic && pages.ssr.dynamic[dynamic];
    if (dynamicSSR) {
      if (dynamic.startsWith("/api/")) {
        return {
          isApi: true,
          page: dynamicSSR
        };
      } else {
        return {
          isData: false,
          isRender: true,
          page: dynamicSSR
        };
      }
    }
    const dynamicHTML = dynamic && pages.html.dynamic[dynamic];
    if (dynamicHTML) {
      return {
        isData: false,
        isStatic: true,
        file: dynamicHTML
      };
    }
  }

  return notFoundPage(uri, manifest, routesManifest);
};
