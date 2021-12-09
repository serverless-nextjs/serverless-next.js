import { addDefaultLocaleToPath } from "../route/locale";
import { PageManifest, RoutesManifest } from "../types";

/*
 * Dynamic SSR + dynamic SSG fallback + dynamic SSG with ISR
 */
const filterDynamic = (manifest: PageManifest) => {
  const isrSources: { [key: string]: boolean } = {};
  for (const ssg of Object.values(manifest.pages.ssg.nonDynamic)) {
    if (ssg.initialRevalidateSeconds && ssg.srcRoute) {
      isrSources[ssg.srcRoute] = true;
    }
  }

  return Object.fromEntries(
    Object.entries(manifest.pages.ssr.dynamic).filter(([key]) => {
      const dynamicSSG = manifest.pages.ssg.dynamic[key];
      return !dynamicSSG || dynamicSSG.fallback !== false || isrSources[key];
    })
  );
};

/*
 * Non-dynamic SSR + non-dynamic SSG with ISR
 */
const filterNonDynamic = (
  manifest: PageManifest,
  routesManifest: RoutesManifest
) => {
  const ssgPages = manifest.pages.ssg.nonDynamic;
  return Object.fromEntries(
    Object.entries(manifest.pages.ssr.nonDynamic).filter(([key]) => {
      const nonDynamicSSG =
        ssgPages[key] || ssgPages[addDefaultLocaleToPath(key, routesManifest)];
      return !nonDynamicSSG || nonDynamicSSG.initialRevalidateSeconds;
    })
  );
};

/*
 * Keeps only required SSR pages.
 */
export const usedSSR = (
  manifest: PageManifest,
  routesManifest: RoutesManifest
) => {
  // If there are API pages, preview mode is possible meaning everything has to be kept
  if (manifest.hasApiPages) {
    return manifest.pages.ssr;
  }

  return {
    dynamic: filterDynamic(manifest),
    nonDynamic: filterNonDynamic(manifest, routesManifest)
  };
};
