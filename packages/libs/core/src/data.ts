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
 * Handles a data route
 */
export const handleDataReq = (
  uri: string,
  manifest: PageManifest,
  isPreview: boolean
): DataRoute | StaticRoute => {
  const { buildId, pages } = manifest;
  const normalisedUri = normaliseDataUri(uri, buildId);
  if (pages.html.nonDynamic[normalisedUri]) {
    return {
      isData: true,
      isStatic: true,
      file: uri
    };
  }
  if (pages.ssg.nonDynamic[normalisedUri] && !isPreview) {
    return {
      isData: true,
      isStatic: true,
      file: uri
    };
  }
  if (
    pages.ssr.nonDynamic[normalisedUri] ||
    pages.ssg.nonDynamic[normalisedUri]
  ) {
    return {
      isData: true,
      isRender: true,
      page: pages.ssr.nonDynamic[normalisedUri]
    };
  }
  // TODO: this order reproduces default-handler logic,
  // should sort all dynamic routes together in build
  const dynamicSSG = matchDynamicSSG(uri, pages.ssg.dynamic, true);
  if (dynamicSSG) {
    return {
      isData: true,
      isStatic: true,
      file: uri
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
  const dynamicHTML = matchDynamic(
    normalisedUri,
    Object.values(pages.html.dynamic)
  );
  if (dynamicHTML) {
    return {
      isData: true,
      isStatic: true,
      file: dynamicHTML
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
