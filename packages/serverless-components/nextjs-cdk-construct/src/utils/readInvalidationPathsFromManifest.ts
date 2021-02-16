import * as path from "path";
import { OriginRequestDefaultHandlerManifest } from "@sls-next/lambda-at-edge";

const dynamicPathToInvalidationPath = (dynamicPath: string) => {
  const [firstSegment] = dynamicPath.split("/:");
  return path.join(firstSegment || "/", "*");
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
