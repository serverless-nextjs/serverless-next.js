import { CloudFrontResultResponse } from "aws-lambda";
import { RoutesManifest } from "../../types";
import { matchPath } from "../routing/matcher";
import { HeaderBag } from "@aws-sdk/types";

// @ts-ignore
import * as _ from "../lib/lodash";

export function addHeadersToResponse(
  path: string,
  response: CloudFrontResultResponse,
  routesManifest: RoutesManifest
): void {
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

export function addS3HeadersToResponse(s3Headers: HeaderBag | undefined) {
  if (!s3Headers) return {};
  const headers: Record<string, [{ key: string; value: string }]> = {};

  for (const [key, value] of Object.entries(s3Headers)) {
    //https://stackoverflow.com/questions/61539544/remove-content-length-using-aws-lambdaedge
    if (key !== "accept-encoding" && key !== "content-length") {
      headers[key] = [
        {
          key: getHeaderKey(key),
          value: value
        }
      ];
    }
  }
  return headers;
}

function getHeaderKey(key: string): string {
  if (key.startsWith("x-")) {
    return key;
  } else if (key === "etag") {
    return "ETag";
  } else {
    return _.startCase(key).replace(" ", "-");
  }
}
