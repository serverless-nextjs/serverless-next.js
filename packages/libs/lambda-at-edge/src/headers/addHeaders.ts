import { CloudFrontResultResponse } from "aws-lambda";
import { RoutesManifest } from "../types";
import { matchPath } from "../routing/matcher";
import { addDefaultLocaleToPath } from "../routing/common-utils";

export function addHeadersToResponse(
  path: string,
  response: CloudFrontResultResponse,
  routesManifest: RoutesManifest
): void {
  path = addDefaultLocaleToPath(path, routesManifest);

  // Add custom headers to response
  if (response.headers) {
    for (const headerData of routesManifest.headers) {
      const match = matchPath(path, headerData.source);

      if (match) {
        for (const header of headerData.headers) {
          if (header.key && header.value) {
            const headerLowerCase = header.key.toLowerCase();
            response.headers[headerLowerCase] = [
              {
                key: headerLowerCase,
                value: header.value
              }
            ];
          }
        }
      }
    }
  }
}
