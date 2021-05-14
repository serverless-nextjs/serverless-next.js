import { normalise } from "./basepath";
import { addDefaultLocaleToPath } from "./locale";
import { matchDynamic, matchDynamicSSG } from "./match";
import { getRewritePath, isExternalRewrite } from "./rewrite";
import {
  ExternalRoute,
  PageManifest,
  PageRoute,
  RoutesManifest
} from "./types";

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
    return {
      isData: false,
      isStatic: true,
      file: pages.html.nonDynamic[localeUri]
    };
  }
  if (pages.ssg.nonDynamic[localeUri] && !isPreview) {
    return {
      isData: false,
      isStatic: true,
      file: `pages${localeUri}.html`
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

  // TODO: this order reproduces default-handler logic
  const dynamicSSG = matchDynamicSSG(localeUri, pages.ssg.dynamic, false);
  if (dynamicSSG) {
    return {
      isData: false,
      isStatic: true,
      file: `pages${localeUri}.html`
    };
  }
  const dynamicSSR = matchDynamic(localeUri, Object.values(pages.ssr.dynamic));
  if (dynamicSSR) {
    return {
      isData: false,
      isRender: true,
      page: dynamicSSR
    };
  }
  const dynamicHTML = matchDynamic(
    localeUri,
    Object.values(pages.html.dynamic)
  );
  if (dynamicHTML) {
    return {
      isData: false,
      isStatic: true,
      file: dynamicHTML
    };
  }
  const catchAll = matchDynamic(localeUri, Object.values(pages.ssr.catchAll));
  if (catchAll) {
    return {
      isData: false,
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
    isData: false,
    isRender: true,
    page: "pages/_error.js"
  };
};
