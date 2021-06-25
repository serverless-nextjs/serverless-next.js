import { normalise } from "./basepath";
import { addDefaultLocaleToPath, dropLocaleFromPath } from "./locale";
import { matchDynamicRoute } from "../match";
import { notFoundPage } from "./notfound";
import { getRewritePath, isExternalRewrite } from "./rewrite";
import {
  ExternalRoute,
  PageManifest,
  PageRoute,
  RoutesManifest
} from "../types";

const pageHtml = (localeUri: string) => {
  if (localeUri == "/") {
    return "pages/index.html";
  }
  return `pages${localeUri}.html`;
};

export const handlePageReq = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  isPreview: boolean,
  isRewrite?: boolean
): ExternalRoute | PageRoute => {
  const { pages } = manifest;
  const localeUri = normalise(
    addDefaultLocaleToPath(uri, routesManifest),
    routesManifest
  );
  if (pages.html.nonDynamic[localeUri]) {
    const nonLocaleUri = dropLocaleFromPath(localeUri, routesManifest);
    const statusCode =
      nonLocaleUri === "/404" ? 404 : nonLocaleUri === "/500" ? 500 : undefined;
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
      nonLocaleUri === "/404" ? 404 : nonLocaleUri === "/500" ? 500 : undefined;
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
  if (pages.ssr.nonDynamic[localeUri]) {
    return {
      isData: false,
      isRender: true,
      page: pages.ssr.nonDynamic[localeUri]
    };
  }

  const rewrite = !isRewrite && getRewritePath(uri, routesManifest);
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

  const dynamic = matchDynamicRoute(localeUri, pages.dynamic);

  const dynamicSSG = dynamic && pages.ssg.dynamic[dynamic];
  if (dynamicSSG) {
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
    return {
      isData: false,
      isRender: true,
      page: dynamicSSR
    };
  }
  const dynamicHTML = dynamic && pages.html.dynamic[dynamic];
  if (dynamicHTML) {
    return {
      isData: false,
      isStatic: true,
      file: dynamicHTML
    };
  }

  return notFoundPage(uri, manifest, routesManifest);
};
