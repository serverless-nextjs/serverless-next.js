/**
 * This and related code are adapted from https://github.com/vercel/next.js/blob/48acc479f3befb70de800392315831ed7defa4d8/packages/next/next-server/server/image-optimizer.ts
 * The MIT License (MIT)

 Copyright (c) 2020 Vercel, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { mediaType } from "@hapi/accept";
import { createHash } from "crypto";
import * as fs from "fs";
import { createReadStream, promises } from "fs";
import { IncomingMessage, ServerResponse } from "http";
// @ts-ignore no types for is-animated
import isAnimated from "is-animated";
import fetch from "node-fetch";
import { join } from "path";
import { UrlWithParsedQuery } from "url";
import { ImageConfig, ImagesManifest } from "../build/types";
import { PlatformClient } from "../platform";
import { imageConfigDefault } from "./imageConfig";
import { sendEtagResponse } from "./sendEtagResponse";
import { getContentType, getExtension } from "./serveStatic";

let sharp: typeof import("sharp");
const AVIF = "image/avif";
const WEBP = "image/webp";
const PNG = "image/png";
const JPEG = "image/jpeg";
const GIF = "image/gif";
const SVG = "image/svg+xml";
const CACHE_VERSION = 2;
const ANIMATABLE_TYPES = [WEBP, PNG, GIF];
const VECTOR_TYPES = [SVG];

type ImageOptimizerResponse = {
  finished: boolean;
};

function parseCacheControl(str: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!str) {
    return map;
  }
  for (const directive of str.split(",")) {
    let [key, value] = directive.trim().split("=");
    key = key.toLowerCase();
    if (value) {
      value = value.toLowerCase();
    }
    map.set(key, value);
  }
  return map;
}

export function getMaxAge(str: string | undefined): number {
  const minimum = 60;
  const map = parseCacheControl(str);
  if (map) {
    let age = map.get("s-maxage") || map.get("max-age") || "";
    if (age.startsWith('"') && age.endsWith('"')) {
      age = age.slice(1, -1);
    }
    const n = parseInt(age, 10);
    if (!isNaN(n)) {
      return Math.max(n, minimum);
    }
  }
  return minimum;
}

/**
 * If Basepath set, it needs to be removed from URL
 *
 * Not normalised -> error 403
 * url: '<base-path>/assets/images/logo.svg',
 *
 * Normalised -> 200
 * url: '/assets/images/logo.svg',
 */
export function normaliseUri(uri: string, basePath: string): string {
  if (uri.startsWith(basePath)) {
    uri = uri.slice(basePath.length);
  }

  return uri;
}

export async function imageOptimizer(
  basePath: string,
  imagesManifest: ImagesManifest | undefined,
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: UrlWithParsedQuery,
  platformClient: PlatformClient
): Promise<ImageOptimizerResponse> {
  const imageConfig: ImageConfig = imagesManifest?.images ?? imageConfigDefault;
  const {
    deviceSizes = [],
    imageSizes = [],
    domains = [],
    formats = ["image/webp"],
    loader
  } = imageConfig;
  const sizes = [...deviceSizes, ...imageSizes];

  if (loader !== "default") {
    res.statusCode = 404;
    res.end("default loader not found");
    return { finished: true };
  }

  const { headers } = req;
  const { url, w, q } = parsedUrl.query;
  const mimeType = getSupportedMimeType(formats, headers.accept);
  let href: string;

  if (!url) {
    res.statusCode = 400;
    res.end('"url" parameter is required');
    return { finished: true };
  } else if (Array.isArray(url)) {
    res.statusCode = 400;
    res.end('"url" parameter cannot be an array');
    return { finished: true };
  }

  let isAbsolute: boolean;

  if (url.startsWith("/")) {
    // Ensure that Basepath is in the URL, otherwise, a 400 is triggered (same behaviour as Nextjs)
    if (basePath !== "/" && !url.startsWith(basePath)) {
      res.statusCode = 400;
      res.end('"Basepath" set but not added to the URL');
      return { finished: true };
    }

    href = normaliseUri(url, basePath);
    isAbsolute = false;
  } else {
    let hrefParsed: URL;

    try {
      hrefParsed = new URL(url);
      href = hrefParsed.toString();
      isAbsolute = true;
    } catch (_error) {
      res.statusCode = 400;
      res.end('"url" parameter is invalid');
      return { finished: true };
    }

    if (!["http:", "https:"].includes(hrefParsed.protocol)) {
      res.statusCode = 400;
      res.end('"url" parameter is invalid');
      return { finished: true };
    }

    if (!domains.includes(hrefParsed.hostname)) {
      res.statusCode = 400;
      res.end('"url" parameter is not allowed');
      return { finished: true };
    }
  }

  if (!w) {
    res.statusCode = 400;
    res.end('"w" parameter (width) is required');
    return { finished: true };
  } else if (Array.isArray(w)) {
    res.statusCode = 400;
    res.end('"w" parameter (width) cannot be an array');
    return { finished: true };
  }

  if (!q) {
    res.statusCode = 400;
    res.end('"q" parameter (quality) is required');
    return { finished: true };
  } else if (Array.isArray(q)) {
    res.statusCode = 400;
    res.end('"q" parameter (quality) cannot be an array');
    return { finished: true };
  }

  const width = parseInt(w, 10);

  if (!width || isNaN(width)) {
    res.statusCode = 400;
    res.end('"w" parameter (width) must be a number greater than 0');
    return { finished: true };
  }

  if (!sizes.includes(width)) {
    res.statusCode = 400;
    res.end(`"w" parameter (width) of ${width} is not allowed`);
    return { finished: true };
  }

  const quality = parseInt(q);

  if (isNaN(quality) || quality < 1 || quality > 100) {
    res.statusCode = 400;
    res.end('"q" parameter (quality) must be a number between 1 and 100');
    return { finished: true };
  }

  const hash = getHash([CACHE_VERSION, href, width, quality, mimeType]);
  const imagesDir = join("/tmp", "cache", "images"); // Use Lambda tmp directory
  const hashDir = join(imagesDir, hash);
  const now = Date.now();

  if (fs.existsSync(hashDir)) {
    const files = await promises.readdir(hashDir);
    for (const file of files) {
      const [prefix, etag, extension] = file.split(".");
      const expireAt = Number(prefix);
      const contentType = getContentType(extension);
      const fsPath = join(hashDir, file);
      if (now < expireAt) {
        if (!res.getHeader("Cache-Control")) {
          res.setHeader("Cache-Control", "public, max-age=60");
        }
        if (sendEtagResponse(req, res, etag)) {
          return { finished: true };
        }
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        createReadStream(fsPath).pipe(res);
        return { finished: true };
      } else {
        await promises.unlink(fsPath);
      }
    }
  }

  let upstreamBuffer: Buffer | undefined;
  let upstreamType: string | undefined;
  let maxAge: number;

  if (isAbsolute) {
    const upstreamRes = await fetch(href);

    if (!upstreamRes.ok) {
      res.statusCode = upstreamRes.status;
      res.end('"url" parameter is valid but upstream response is invalid');
      return { finished: true };
    }

    res.statusCode = upstreamRes.status;
    upstreamBuffer = Buffer.from(await upstreamRes.arrayBuffer());
    upstreamType = upstreamRes.headers.get("Content-Type") ?? undefined;
    maxAge = getMaxAge(upstreamRes.headers.get("Cache-Control") ?? undefined);
    if (upstreamRes.headers.get("Cache-Control")) {
      res.setHeader(
          "Cache-Control",
          upstreamRes.headers.get("Cache-Control") as string
      );
    }
  } else {
    let objectKey;
    try {
      // note: basepath is already removed by URI normalization above
      if (href.startsWith(`/static`) || href.startsWith(`/_next/static`)) {
        objectKey = `${basePath}${href}`; // static files' URL map to the key prefixed with basepath e.g /static/ -> static
      } else {
        objectKey = `${basePath}/public` + href; // public file URLs map from /public.png -> public/public.png
      }

      // Remove leading slash from object key
      if (objectKey.startsWith("/")) {
        objectKey = objectKey.slice(1);
      }

      const response = await platformClient.getObject(objectKey);

      res.statusCode = response.statusCode;

      upstreamBuffer = response.body ?? Buffer.of();
      upstreamType = response.contentType ?? undefined;
      maxAge = getMaxAge(response.cacheControl);

      // If object response provides cache control header, use that
      if (response.cacheControl) {
        res.setHeader("Cache-Control", response.cacheControl);
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.end('"url" parameter is valid but upstream response is invalid');
      console.error(
        `Error processing upstream response due to error for key: ${objectKey}. Stack trace: ` +
          err.stack
      );
      return { finished: true };
    }
  }

  if (upstreamType) {
    const vector = VECTOR_TYPES.includes(upstreamType);
    const animate =
      ANIMATABLE_TYPES.includes(upstreamType) && isAnimated(upstreamBuffer);
    if (vector || animate) {
      sendResponse(req, res, upstreamType, upstreamBuffer);
      return { finished: true };
    }
  }

  const expireAt = maxAge * 1000 + now;
  let contentType: string;

  if (mimeType) {
    contentType = mimeType;
  } else if (upstreamType?.startsWith("image/") && getExtension(upstreamType)) {
    contentType = upstreamType;
  } else {
    contentType = JPEG;
  }

  if (!sharp) {
    try {
      sharp = require("sharp");
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        error.message += "\n\nLearn more: https://err.sh/next.js/install-sharp";
        console.error(error.stack);
        sendResponse(req, res, upstreamType, upstreamBuffer);
        return { finished: true };
      }
      throw error;
    }
  }

  try {
    const transformer = sharp(upstreamBuffer);
    transformer.rotate(); // auto rotate based on EXIF data

    const { width: metaWidth } = await transformer.metadata();

    if (metaWidth && metaWidth > width) {
      transformer.resize(width);
    }

    if (contentType === AVIF) {
      transformer.avif({ quality });
    } else if (contentType === WEBP) {
      transformer.webp({ quality });
    } else if (contentType === PNG) {
      transformer.png({ quality });
    } else if (contentType === JPEG) {
      transformer.jpeg({ quality });
    }

    const optimizedBuffer = await transformer.toBuffer();
    await promises.mkdir(hashDir, { recursive: true });
    const extension = getExtension(contentType);
    const etag = getHash([optimizedBuffer]);
    const filename = join(hashDir, `${expireAt}.${etag}.${extension}`);
    await promises.writeFile(filename, optimizedBuffer);
    sendResponse(req, res, contentType, optimizedBuffer);
  } catch (error: any) {
    console.error(
      "Error processing image with sharp, returning upstream image as fallback instead: " +
        error.stack
    );
    sendResponse(req, res, upstreamType, upstreamBuffer);
  }

  return { finished: true };
}

function sendResponse(
  req: IncomingMessage,
  res: ServerResponse,
  contentType: string | undefined,
  buffer: Buffer
) {
  const etag = getHash([buffer]);
  if (!res.getHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "public, max-age=60");
  }
  if (sendEtagResponse(req, res, etag)) {
    return;
  }
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  res.end(buffer);
}

function getSupportedMimeType(options: string[], accept = ""): string {
  const mimeType = mediaType(accept, options);
  return accept.includes(mimeType) ? mimeType : "";
}

function getHash(items: (string | number | Buffer)[]) {
  const hash = createHash("sha256");
  for (const item of items) {
    if (typeof item === "number") hash.update(String(item));
    else {
      hash.update(item);
    }
  }
  // See https://en.wikipedia.org/wiki/Base64#Filenames
  return hash.digest("base64").replace(/\//g, "-");
}
