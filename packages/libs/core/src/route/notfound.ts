import { getLocalePrefixFromUri } from "./locale";
import {
  DataRoute,
  PageManifest,
  PageRoute,
  RoutesManifest,
  StaticRoute
} from "../types";

export const staticNotFound = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest
): (StaticRoute & PageRoute) | undefined => {
  const localePrefix = getLocalePrefixFromUri(uri, routesManifest);
  const notFoundUri = `${localePrefix}/404`;
  const static404 =
    manifest.pages.html.nonDynamic[notFoundUri] ||
    manifest.pages.ssg.nonDynamic[notFoundUri];
  if (static404) {
    return {
      isData: false,
      isStatic: true,
      file: `pages${notFoundUri}.html`,
      statusCode: 404
    };
  }
};

export const notFoundData = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest
): DataRoute | StaticRoute => {
  return (
    staticNotFound(uri, manifest, routesManifest) || {
      isData: true,
      isRender: true,
      page: "pages/_error.js",
      statusCode: 404
    }
  );
};

export const notFoundPage = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest
): PageRoute => {
  return (
    staticNotFound(uri, manifest, routesManifest) || {
      isData: false,
      isRender: true,
      page: "pages/_error.js",
      statusCode: 404
    }
  );
};
