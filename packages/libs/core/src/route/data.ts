import { addDefaultLocaleToPath, dropLocaleFromPath } from "./locale";
import { matchDynamicRoute } from "../match";
import { notFoundData } from "./notfound";
import { DataRoute, PageManifest, RoutesManifest, StaticRoute } from "../types";

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
    return `${prefix}/index.json`;
  }
  return `${prefix}${uri}.json`;
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
  const localeUri = addDefaultLocaleToPath(
    normaliseDataUri(uri, buildId),
    routesManifest
  );
  if (pages.ssg.nonDynamic[localeUri] && !isPreview) {
    const ssg = pages.ssg.nonDynamic[localeUri];
    const route = ssg.srcRoute ?? localeUri;
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(localeUri, buildId),
      page: pages.ssr.nonDynamic[route], // page JS path is from SSR entries in manifest,
      revalidate: ssg.initialRevalidateSeconds
    };
  }
  // Handle encoded ISR data request. Although it's not recommended to use non-URL safe chars, Next.js does handle this case
  const decodedUri = decodeURI(localeUri);
  if (pages.ssg.nonDynamic[decodedUri] && !isPreview) {
    const ssg = pages.ssg.nonDynamic[decodedUri];
    if (ssg.initialRevalidateSeconds) {
      const route = ssg.srcRoute ?? decodedUri;
      return {
        isData: true,
        isStatic: true,
        file: fullDataUri(localeUri, buildId), // use encoded URL as this is set to CF request, which needs encoded URI
        page: pages.ssr.nonDynamic[route], // page JS path is from SSR entries in manifest,
        revalidate: ssg.initialRevalidateSeconds
      };
    }
  }
  if ((pages.ssg.notFound ?? {})[localeUri] && !isPreview) {
    return notFoundData(uri, manifest, routesManifest);
  }
  if (pages.ssr.nonDynamic[localeUri]) {
    return {
      isData: true,
      isRender: true,
      page: pages.ssr.nonDynamic[localeUri]
    };
  }

  const dynamic = matchDynamicRoute(localeUri, pages.dynamic);

  const dynamicSSG = dynamic && pages.ssg.dynamic[dynamic];
  if (dynamicSSG && !isPreview) {
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(localeUri, buildId),
      page: dynamic ? pages.ssr.dynamic[dynamic] : undefined, // page JS path is from SSR entries in manifest
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

  return notFoundData(uri, manifest, routesManifest);
};
