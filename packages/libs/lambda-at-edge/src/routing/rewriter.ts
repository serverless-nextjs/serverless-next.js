import { compileDestination } from "./matcher";
import { RewriteData, RoutesManifest } from "../../types";
import { IncomingMessage, ServerResponse } from "http";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

/**
 * Get the rewrite of the given path, if it exists. Otherwise return null.
 * @param path
 * @param queryParams
 * @param routesManifest
 * @param router
 * @param normalisedPath
 */
export function getRewritePath(
  path: string,
  queryParams: Params,
  routesManifest: RoutesManifest,
  router: (uri: string) => string | null,
  normalisedPath: string
): string | null {
  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const matcher = getPathMatch(rewrite.source);

    let params = matcher(path);

    if (rewrite.has && params) {
      const hasParams = matchHas(
        {
          headers: {},
          cookies: {}
        } as any,
        rewrite.has,
        queryParams
      );

      if (hasParams) {
        Object.assign(params, hasParams);
      } else {
        params = false;
      }
    }

    if (params) {
      const destination = compileDestination(rewrite.destination, params);

      // No-op rewrite support: skip to next rewrite if path does not map to existing non-dynamic and dynamic routes
      if (path === destination) {
        const url = router(normalisedPath);

        if (url === "pages/404.html" || url === "pages/_error.js") {
          continue;
        }
      }

      return destination;
    }
  }

  return null;
}

export function isExternalRewrite(customRewrite: string): boolean {
  return (
    customRewrite.startsWith("http://") || customRewrite.startsWith("https://")
  );
}

// Blacklisted or read-only headers in CloudFront
const ignoredHeaders = [
  "connection",
  "expect",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "trailer",
  "upgrade",
  "x-accel-buffering",
  "x-accel-charset",
  "x-accel-limit-rate",
  "x-accel-redirect",
  "x-cache",
  "x-forwarded-proto",
  "x-real-ip",
  "content-length",
  "host",
  "transfer-encoding",
  "via",
  "content-encoding"
];

const ignoredHeaderPrefixes = ["x-amz-cf-", "x-amzn-", "x-edge-"];

function isIgnoredHeader(name: string): boolean {
  const lowerCaseName = name.toLowerCase();

  for (const prefix of ignoredHeaderPrefixes) {
    if (lowerCaseName.startsWith(prefix)) {
      return true;
    }
  }

  return ignoredHeaders.includes(lowerCaseName);
}

export async function createExternalRewriteResponse(
  customRewrite: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const { default: fetch } = await import("node-fetch");
  const fetchResponse = await fetch(customRewrite);

  for (const [name, val] of fetchResponse.headers.entries()) {
    if (!isIgnoredHeader(name)) {
      res.setHeader(name, val);
    }
  }
  res.statusCode = fetchResponse.status;
  const text = await fetchResponse.text();
  res.end(text);
}
