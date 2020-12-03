import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/image-handler";
import { CloudFrontResponseResult } from "next-aws-cloudfront/node_modules/@types/aws-lambda";
import { runRedirectTestWithHandler } from "../utils/runRedirectTest";

jest.mock("@aws-sdk/client-s3/S3Client", () =>
  require("../mocks/s3/aws-sdk-s3-client.image.mock")
);

jest.mock("@aws-sdk/client-s3/commands/GetObjectCommand", () =>
  require("../mocks/s3/aws-sdk-s3-client-get-object-command.mock")
);

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
  () => require("./image-basepath-routes-manifest.json"),
  {
    virtual: true
  }
);

describe("Image lambda handler", () => {
  if (process.version.startsWith("v10")) {
    it("skipping tests for Node.js that is on v10", () => {});
    return;
  }

  describe("Routes", () => {
    it("serves image request", async () => {
      const event = createCloudFrontEvent({
        uri: "/basepath/_next/image?url=%2Ftest-image.png&q=100&w=128",
        host: "mydistribution.cloudfront.net",
        requestHeaders: {
          Accept: [
            {
              key: "Accept",
              value: "*/*"
            }
          ]
        }
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response).toEqual({
        headers: {
          "cache-control": [
            {
              key: "cache-control",
              value: "public, max-age=60"
            }
          ],
          etag: [
            {
              key: "etag",
              value: expect.any(String)
            }
          ],
          "content-type": [{ key: "content-type", value: "image/png" }]
        },
        status: 200,
        statusDescription: "OK",
        body: expect.any(String),
        bodyEncoding: "base64"
      });
    });

    it("return 500 response when s3 throw an error", async () => {
      const event = createCloudFrontEvent({
        uri: "/basepath/_next/image?url=%2Fthrow-error.png&q=100&w=128",
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual(500);
    });

    it.each`
      path
      ${"/basepath/_next/image?url=%2Ftest-image.png&q=100"}
      ${"/basepath/_next/image?url=%2Ftest-image.png&w=64"}
      ${"/basepath/_next/image?w=64&q=100"}
      ${"/basepath/_next/image?url=%2Ftest-image.png&q=100&w=100"}
      ${"/basepath/_next/image?url=%2Ftest-image.png&q=101&w=64"}
    `("returns 400 for path $path", async ({ path }) => {
      const event = createCloudFrontEvent({
        uri: path,
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual(400);
    });

    it("returns 404 for non-image routes", async () => {
      const event = createCloudFrontEvent({
        uri: "/basepath/_next/not-image",
        host: "mydistribution.cloudfront.net"
      });

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual("404");
    });
  });

  let runRedirectTest = async (
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
      path                       | querystring | expectedRedirect                                         | expectedRedirectStatusCode
      ${"/basepath/_next/image"} | ${""}       | ${"https://www.example.com/basepath/_next/image"}        | ${308}
      ${"/basepath/_next/image"} | ${"a=1234"} | ${"https://www.example.com/basepath/_next/image?a=1234"} | ${308}
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
