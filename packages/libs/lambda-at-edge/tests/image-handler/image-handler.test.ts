import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/image-handler";
import { CloudFrontResponseResult } from "next-aws-cloudfront/node_modules/@types/aws-lambda";
import { runRedirectTestWithHandler } from "../utils/runRedirectTest";
import sharp from "sharp";
import fetchMock from "fetch-mock";
import { mockSend } from "../mocks/s3/aws-sdk-s3-client.image.mock";

const MockGetObjectCommand = jest.fn();

jest.mock("@aws-sdk/client-s3/S3Client", () =>
  require("../mocks/s3/aws-sdk-s3-client.image.mock")
);

jest.mock("@aws-sdk/client-s3/commands/GetObjectCommand", () => {
  return {
    GetObjectCommand: MockGetObjectCommand
  };
});

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

describe("Image lambda handler", () => {
  if (process.version.startsWith("v10")) {
    it("skipping tests for Node.js that is on v10", () => {
      // do nothing
    });
    return;
  }

  describe("Routes", () => {
    it.each`
      imagePath                         | expectedS3Key
      ${"/test-image.png"}              | ${"public/test-image.png"}
      ${"/static/test-image.png"}       | ${"static/test-image.png"}
      ${"/_next/static/test-image.png"} | ${"_next/static/test-image.png"}
    `("serves image request", async ({ imagePath, expectedS3Key }) => {
      const event = createCloudFrontEvent({
        uri: `/_next/image?url=${encodeURI(imagePath)}&q=100&w=128`,
        host: "mydistribution.cloudfront.net",
        requestHeaders: {
          accept: [
            {
              key: "accept",
              value: "image/webp"
            }
          ]
        }
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response).toEqual({
        headers: {
          "cache-control": [
            {
              key: "Cache-Control",
              value: "public, max-age=60"
            }
          ],
          etag: [
            {
              key: "ETag",
              value: expect.any(String)
            }
          ],
          "content-type": [{ key: "Content-Type", value: "image/webp" }]
        },
        status: 200,
        statusDescription: "OK",
        body: expect.any(String),
        bodyEncoding: "base64"
      });

      expect(MockGetObjectCommand).toBeCalledWith({
        Bucket: "my-bucket.s3.amazonaws.com",
        Key: expectedS3Key
      });
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

      fetchMock.get("https://allowed.com/image.png", {
        body: imageBuffer,
        headers: { "Content-Type": "image/png" }
      });

      const event = createCloudFrontEvent({
        uri: "/_next/image?url=https%3A%2F%2Fallowed.com%2Fimage.png&q=100&w=64",
        host: "mydistribution.cloudfront.net",
        requestHeaders: {
          accept: [
            {
              key: "Accept",
              value: "image/webp"
            }
          ]
        }
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response).toEqual({
        headers: {
          "cache-control": [
            {
              key: "Cache-Control",
              value: "public, max-age=60"
            }
          ],
          etag: [
            {
              key: "ETag",
              value: expect.any(String)
            }
          ],
          "content-type": [{ key: "Content-Type", value: "image/webp" }]
        },
        status: 200,
        statusDescription: "OK",
        body: expect.any(String),
        bodyEncoding: "base64"
      });
    });

    it("return 500 response when s3 throws an error", async () => {
      mockSend.mockRejectedValueOnce(new Error("Mocked S3 error"));

      const event = createCloudFrontEvent({
        uri: "/_next/image?url=%2Ftest-image.png&q=100&w=128",
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual(500);
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
      const event = createCloudFrontEvent({
        uri: path,
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual(400);
    });

    it("returns 404 for non-image routes", async () => {
      const event = createCloudFrontEvent({
        uri: "/_next/not-image",
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual("404");
    });
  });

  const runRedirectTest = async (
    path: string,
    expectedRedirect: string,
    statusCode: number,
    querystring?: string,
    host?: string
  ): Promise<void> => {
    await runRedirectTestWithHandler(
      handler,
      path,
      expectedRedirect,
      statusCode,
      querystring,
      host
    );
  };

  describe("Domain Redirects", () => {
    it.each`
      path              | querystring | expectedRedirect                                | expectedRedirectStatusCode
      ${"/_next/image"} | ${""}       | ${"https://www.example.com/_next/image"}        | ${308}
      ${"/_next/image"} | ${"a=1234"} | ${"https://www.example.com/_next/image?a=1234"} | ${308}
    `(
      "redirects path $path to $expectedRedirect, expectedRedirectStatusCode: $expectedRedirectStatusCode",
      async ({
        path,
        querystring,
        expectedRedirect,
        expectedRedirectStatusCode
      }) => {
        await runRedirectTest(
          path,
          expectedRedirect,
          expectedRedirectStatusCode,
          querystring,
          "example.com" // Override host to test a domain redirect from host example.com -> https://www.example.com
        );
      }
    );
  });
});
