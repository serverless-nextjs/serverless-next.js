import { compileDestination, matchPath } from "./matcher";
import { RewriteData, RoutesManifest } from "../types";
import { IncomingMessage, ServerResponse } from "http";
import { addDefaultLocaleToPath, isLocalePrefixedUri } from "./locale-utils";

/**
 * Get the rewrite of the given path, if it exists. Otherwise return null.
 * @param path
 * @param routesManifest
 * @param router
 * @param normalisedPath
 */
export function getRewritePath(
  path: string,
  routesManifest: RoutesManifest,
  router: (uri: string) => string | null,
  normalisedPath: string
): string | null {
  path = addDefaultLocaleToPath(path, routesManifest);

  const rewrites: RewriteData[] = routesManifest.rewrites;

  for (const rewrite of rewrites) {
    const match = matchPath(path, rewrite.source);

    if (match) {
      let destination = compileDestination(rewrite.destination, match.params);

      // No-op rewrite support: skip to next rewrite if path does not map to existing non-dynamic and dynamic routes
      if (path === destination) {
        const url = router(normalisedPath);

        if (url === "pages/404.html" || url === "pages/_error.js") {
          continue;
        }
      }

      // Pass params to destination for locale rewrites
      // Except nextInternalLocale param since it's already in path prefix
      if (destination && isLocalePrefixedUri(path, routesManifest)) {
        const querystring = Object.keys(match.params)
          .filter((key) => key !== "nextInternalLocale")
          // @ts-ignore
          .map((key) => {
            // @ts-ignore
            const param = match.params[key];
            if (typeof param === "string") {
              return `${key}=${param}`;
            } else {
              return param.map((val: string) => `${key}=${val}`).join("&");
            }
          })
          .filter((key) => key)
          .join("&");

        if (querystring) {
          destination += destination.includes("?")
            ? `&${querystring}`
            : `?${querystring}`;
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
  "via"
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
  res: ServerResponse,
  body?: string
): Promise<void> {
  const { default: fetch } = await import("node-fetch");

  // Set request headers
  let reqHeaders: any = {};
  Object.assign(reqHeaders, req.headers);

  // Delete host header otherwise request may fail due to host mismatch
  if (reqHeaders.hasOwnProperty("host")) {
    delete reqHeaders.host;
  }

  let fetchResponse;
  if (body) {
    const decodedBody = Buffer.from(body, "base64").toString("utf8");

    fetchResponse = await fetch(customRewrite, {
      headers: reqHeaders,
      method: req.method,
      body: decodedBody, // Must pass body as a string,
      compress: false
    });
  } else {
    fetchResponse = await fetch(customRewrite, {
      headers: reqHeaders,
      method: req.method,
      compress: false
    });
  }

  for (const [name, val] of fetchResponse.headers.entries()) {
    if (!isIgnoredHeader(name)) {
      res.setHeader(name, val);
    }
  }
  res.statusCode = fetchResponse.status;
  res.end(await fetchResponse.buffer());
}
