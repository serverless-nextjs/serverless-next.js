import { matchDynamic, matchDynamicSSG } from "./match";
import { DataRoute, PageManifest, StaticRoute } from "./types";

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

/*
 * Handles a data route
 */
export const handleDataReq = (
  uri: string,
  manifest: PageManifest,
  isPreview: boolean
): DataRoute | StaticRoute => {
  const { buildId, pages } = manifest;
  const normalisedUri = normaliseDataUri(uri, buildId);
  if (pages.ssg.nonDynamic[normalisedUri] && !isPreview) {
    return {
      isData: true,
      isStatic: true,
      file: uri
    };
  }
  if (pages.ssr.nonDynamic[normalisedUri]) {
    return {
      isData: true,
      isRender: true,
      page: pages.ssr.nonDynamic[normalisedUri]
    };
  }
  // TODO: this order reproduces default-handler logic,
  // should sort all dynamic routes together in build
  const dynamicSSG = matchDynamicSSG(
    fullDataUri(normalisedUri, buildId),
    pages.ssg.dynamic,
    true
  );
  if (dynamicSSG) {
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(normalisedUri, buildId)
    };
  }
  const dynamicSSR = matchDynamic(
    normalisedUri,
    Object.values(pages.ssr.dynamic)
  );
  if (dynamicSSR) {
    return {
      isData: true,
      isRender: true,
      page: dynamicSSR
    };
  }
  const catchAll = matchDynamic(
    normalisedUri,
    Object.values(pages.ssr.catchAll)
  );
  if (catchAll) {
    return {
      isData: true,
      isRender: true,
      page: catchAll
    };
  }
  if (pages.html.nonDynamic["/404"]) {
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
