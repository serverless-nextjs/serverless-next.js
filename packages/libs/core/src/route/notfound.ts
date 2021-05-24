import { getLocalePrefixFromUri } from "./locale";
import {
  PageManifest,
  RenderRoute,
  RoutesManifest,
  StaticRoute
} from "../types";

export const notFoundPage = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest
): RenderRoute | StaticRoute => {
  const localePrefix = getLocalePrefixFromUri(uri, routesManifest);
  const notFoundUri = `${localePrefix}/404`;
  const html = manifest.pages.html.nonDynamic[notFoundUri];
  if (html) {
    return {
      isData: false,
      isStatic: true,
      file: html
    };
  }
  const ssg = manifest.pages.ssg.nonDynamic[notFoundUri];
  if (ssg) {
    return {
      isData: false,
      isStatic: true,
      file: `pages${notFoundUri}.html`
    };
  }
  // Only possible in old versions of Next.js
  return {
    isData: false,
    isRender: true,
    page: "pages/_error.js"
  };
};
