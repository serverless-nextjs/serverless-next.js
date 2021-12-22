import sharp from "sharp";
import { ImagesManifest } from "../../src";
import { imageOptimizer } from "../../src/images/imageOptimizer";
import imagesManifest from "./image-images-manifest.json";
import url from "url";
import http from "http";
import Stream from "stream";
import { PlatformClient } from "../../src";
import { jest } from "@jest/globals";

jest.mock("node-fetch", () => require("fetch-mock-jest").sandbox());

jest.mock(
  "../../src/manifest.json",
  () => require("./image-build-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/images-manifest.json",
  () => require("./image-images-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./image-routes-manifest.json"),
  {
    virtual: true
  }
);

describe("Image optimizer", () => {
  const mockPlatformClient = {
    getObject: jest.fn(),
    triggerStaticRegeneration: jest.fn(),
    storePage: jest.fn()
  };

  const createEventByUrl = (
    urlPath: string,
    headers?: { [key: string]: string }
  ) => {
    const parsedUrl = url.parse(urlPath, true);

    const req = Object.assign(
      new Stream.Readable(),
      http.IncomingMessage.prototype
    );
    req.headers = headers ?? {
      accept: "image/webp"
    };
    const res: any = Object.assign(
      new Stream.Readable(),
      http.ServerResponse.prototype
    );

    res.end = () => {
      // intentionally empty
    };
    res.headers = {};
    res.writeHead = (status: number, headers: any) => {
      res.statusCode = status;

      if (headers) {
        res.headers = Object.assign(res.headers, headers);
      }
      return res;
    };
    res.write = () => {
      // intentionally empty
    };
    res.setHeader = (name: string, value: string) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.removeHeader = (name: string) => {
      delete res.headers[name.toLowerCase()];
    };
    res.getHeader = (name: string) => {
      return res.headers[name.toLowerCase()];
    };
    res.getHeaders = () => {
      return res.headers;
    };
    res.hasHeader = (name: string) => {
      return !!res.getHeader(name);
    };

    return { req, res, parsedUrl };
  };

  const createEventByImagePath = (
    imagePath: string,
    headers?: { [key: string]: string }
  ) => {
    return createEventByUrl(
      `/_next/image?url=${encodeURI(imagePath)}&q=100&w=128`,
      headers
    );
  };

  beforeEach(async () => {
    const imageBuffer: Buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    })
      .png()
      .toBuffer();

    mockPlatformClient.getObject.mockReturnValue({
      body: imageBuffer,
      headers: {},
      lastModified: undefined,
      expires: undefined,
      eTag: "etag",
      statusCode: 200,
      cacheControl: undefined,
      contentType: "image/png"
    });
  });

  describe("Routes", () => {
    it.each`
      imagePath                         | accept          | expectedObjectKey
      ${"/test-image.png"}              | ${"image/avif"} | ${"public/test-image.png"}
      ${"/test-image.png"}              | ${"image/webp"} | ${"public/test-image.png"}
      ${"/static/test-image.png"}       | ${"image/webp"} | ${"static/test-image.png"}
      ${"/_next/static/test-image.png"} | ${"image/webp"} | ${"_next/static/test-image.png"}
    `(
      "serves image request",
      async ({ imagePath, accept, expectedObjectKey }) => {
        const { parsedUrl, req, res } = createEventByImagePath(imagePath, {
          accept: accept
        });

        await imageOptimizer(
          "",
          imagesManifest as ImagesManifest,
          req,
          res,
          parsedUrl,
          mockPlatformClient as PlatformClient
        );

        expect(res.getHeaders()).toEqual({
          "cache-control": "public, max-age=60",
          etag: expect.any(String),
          "content-type": accept
        });
        expect(res.statusCode).toEqual(200);

        expect(mockPlatformClient.getObject).toBeCalledWith(expectedObjectKey);
      }
    );

    it.each`
      imagePath
      ${"/test-image-cached.png"}
    `("serves cached image on second request", async ({ imagePath }) => {
      const {
        parsedUrl: parsedUrl1,
        req: req1,
        res: res1
      } = createEventByImagePath(imagePath);
      const {
        parsedUrl: parsedUrl2,
        req: req2,
        res: res2
      } = createEventByImagePath(imagePath);

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req1,
        res1,
        parsedUrl1,
        mockPlatformClient as PlatformClient
      );
      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req2,
        res2,
        parsedUrl2,
        mockPlatformClient as PlatformClient
      );

      expect(res1.statusCode).toEqual(200);
      expect(res2.statusCode).toEqual(200);

      expect(mockPlatformClient.getObject).toBeCalledTimes(1);
    });

    it.each`
      imagePath
      ${"/test-image-etag.png"}
    `("serves 304 when etag matches", async ({ imagePath }) => {
      const {
        parsedUrl: parsedUrl1,
        req: req1,
        res: res1
      } = createEventByImagePath(imagePath);

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req1,
        res1,
        parsedUrl1,
        mockPlatformClient as PlatformClient
      );

      const {
        parsedUrl: parsedUrl2,
        req: req2,
        res: res2
      } = createEventByImagePath(imagePath, {
        accept: "image/webp",
        "if-none-match": res1.getHeader("etag") as string
      });

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req1,
        res1,
        parsedUrl1,
        mockPlatformClient as PlatformClient
      );

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req2,
        res2,
        parsedUrl2,
        mockPlatformClient as PlatformClient
      );

      expect(res2.getHeaders()).toEqual({
        "cache-control": "public, max-age=60",
        etag: res1.getHeader("etag")
      });
      expect(res2.statusCode).toEqual(304);
    });

    it("serves external image request", async () => {
      const imageBuffer: Buffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
      })
        .png()
        .toBuffer();

      const fetchMock = require("node-fetch");

      fetchMock.get("https://allowed.com/image.png", {
        body: imageBuffer,
        headers: {
          "Content-Type": "image/webp"
        }
      });

      const { parsedUrl, req, res } = createEventByImagePath(
        "https://allowed.com/image.png"
      );

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req,
        res,
        parsedUrl,
        mockPlatformClient as PlatformClient
      );

      expect(res.getHeaders()).toEqual({
        "cache-control": "public, max-age=60",
        etag: '"-MEos7nPVi9RjCQMnHdAmrGDydYWJ1GJUF1IEQkQ1Sw="',
        "content-type": "image/webp"
      });

      expect(res.statusCode).toEqual(200);
    });

    // TODO: fix this test
    xit("return 500 response when object store throws an error", async () => {
      mockPlatformClient.getObject.mockRejectedValue(
        new Error("Mocked object store error")
      );

      const { parsedUrl, req, res } = createEventByImagePath("/test-image.png");

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req,
        res,
        parsedUrl,
        mockPlatformClient as PlatformClient
      );

      expect(res.statusCode).toEqual(500);

      expect(mockPlatformClient.getObject).toBeCalledTimes(1);
    });

    it.each`
      path
      ${"/_next/image?url=%2Ftest-image.png&q=100"}
      ${"/_next/image?url=%2Ftest-image.png&w=64"}
      ${"/_next/image?w=64&q=100"}
      ${"/_next/image?url=%2Ftest-image.png&q=100&w=100"}
      ${"/_next/image?url=%2Ftest-image.png&q=101&w=64"}
      ${"/_next/image?url=absoluteUrl&q=101&w=64"}
      ${"/_next/image?url=ftp%3A%2F%2Fexample.com&q=100&w=64"}
      ${"/_next/image?url=https%3A%2F%2Fnotallowed.com%2Fimage.png&q=100&w=64"}
      ${"/_next/image?url=%2Ftest-image.png&url=%2Ftest-image2.png&q=100&w=128"}
      ${"/_next/image?url=%2Ftest-image.png&q=100&q=50&w=128"}
      ${"/_next/image?url=%2Ftest-image.png&q=100&w=128&w=64"}
    `("invalid queries return 400 for path $path", async ({ path }) => {
      const { parsedUrl, req, res } = createEventByUrl(path);

      await imageOptimizer(
        "",
        imagesManifest as ImagesManifest,
        req,
        res,
        parsedUrl,
        mockPlatformClient as PlatformClient
      );

      expect(res.statusCode).toEqual(400);
    });
  });
});
