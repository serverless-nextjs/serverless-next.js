import * as path from "path";
import { OriginRequestDefaultHandlerManifest } from "@sls-next/lambda-at-edge";

const dynamicPathToInvalidationPath = (dynamicPath: string) => {
  // Match "/:", "/[" or "/[[..."
  // Only the last one indicates an optional catch-all group,
  // where a route without both the the group and the slash matches.
  // E.g. /pages/[[...slug]] matches on /pages and /pages/foo

  const firstSplit = dynamicPath.match(/\/(:|\[(\[\.\.\.)?)/);
  const [firstSegment] = dynamicPath.split(/\/[:[]/);

  if (firstSplit && firstSplit[0] === "/[[...") {
    // If the firstSplit is the optional catch-all,
    // append the wildcard directly (without a slash)
    return (firstSegment || "/") + "*";
  }
  // Ensure this is posix path as CloudFront needs forward slash in invalidation
  return path.posix.join(firstSegment || "/", "*");
};

export const readInvalidationPathsFromManifest = (
  manifest: OriginRequestDefaultHandlerManifest
): string[] => {
  return [
    ...Object.keys(manifest.pages.html.dynamic).map(
      dynamicPathToInvalidationPath
    ),
    ...Object.keys(manifest.pages.html.nonDynamic),
    ...Object.keys(manifest.pages.ssr.dynamic).map(
      dynamicPathToInvalidationPath
    ),
    ...Object.keys(manifest.pages.ssr.nonDynamic),
    ...Object.keys(manifest.pages.ssg?.dynamic || {}).map(
      dynamicPathToInvalidationPath
    ),
    ...Object.keys(manifest.pages.ssg?.nonDynamic || {})
  ];
};
