import { dropLocaleFromPath } from "./locale";
import { matchDynamicRoute } from "./match";
import { DataRoute, PageManifest, RoutesManifest, StaticRoute } from "./types";

/*
 * Get page name from data route
 */
const normaliseDataUri = (uri: string, buildId: string) => {
  const prefix = `/_next/data/${buildId}`;
  if (!uri.startsWith(prefix)) {
    return uri;
  }
  return uri
    .slice(prefix.length)
    .replace(/\.json$/, "")
    .replace(/^(\/index)?$/, "/");
};

/*
 * Get full data route uri from page name
 */
const fullDataUri = (uri: string, buildId: string) => {
  const prefix = `/_next/data/${buildId}`;
  if (uri === "/") {
    return `${prefix}/index.js`;
  }
  return `${prefix}${uri}.json`;
};

const handle404 = (manifest: PageManifest): DataRoute | StaticRoute => {
  if (manifest.pages.html.nonDynamic["/404"]) {
    return {
      isData: false,
      isStatic: true,
      file: "pages/404.html"
    };
  }
  return {
    isData: true,
    isRender: true,
    page: "pages/_error.js"
  };
};

/*
 * Handles a data route
 */
export const handleDataReq = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  isPreview: boolean
): DataRoute | StaticRoute => {
  const { buildId, pages } = manifest;
  const normalisedUri = normaliseDataUri(uri, buildId);
  if (pages.ssg.nonDynamic[normalisedUri] && !isPreview) {
    const ssg = pages.ssg.nonDynamic[normalisedUri];
    const route = ssg.srcRoute ?? normalisedUri;
    return {
      isData: true,
      isStatic: true,
      file: uri,
      page: `pages${dropLocaleFromPath(route, routesManifest)}.js`,
      revalidate: ssg.initialRevalidateSeconds
    };
  }
  if (pages.ssr.nonDynamic[normalisedUri]) {
    return {
      isData: true,
      isRender: true,
      page: pages.ssr.nonDynamic[normalisedUri]
    };
  }

  const dynamic = matchDynamicRoute(normalisedUri, pages.dynamic);

  const dynamicSSG = dynamic && pages.ssg.dynamic[dynamic];
  if (dynamicSSG) {
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(normalisedUri, buildId),
      page: `pages${dropLocaleFromPath(dynamic as string, routesManifest)}.js`,
      fallback: dynamicSSG.fallback
    };
  }
  const dynamicSSR = dynamic && pages.ssr.dynamic[dynamic];
  if (dynamicSSR) {
    return {
      isData: true,
      isRender: true,
      page: dynamicSSR
    };
  }

  return handle404(manifest);
};
