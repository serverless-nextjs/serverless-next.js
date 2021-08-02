import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import {
  CloudFrontResultResponse,
  CloudFrontHeaders,
  CloudFrontResponse
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3/S3Client";

jest.mock("@aws-sdk/client-s3/S3Client", () =>
  require("../mocks/s3/aws-sdk-s3-client.mock")
);

jest.mock("@aws-sdk/client-s3/commands/GetObjectCommand", () =>
  require("../mocks/s3/aws-sdk-s3-client-get-object-command.mock")
);

jest.mock("@aws-sdk/client-s3/commands/PutObjectCommand", () =>
  require("../mocks/s3/aws-sdk-s3-client-put-object-command.mock")
);

jest.mock(
  "../../src/manifest.json",
  () => require("./default-build-manifest-origin-response.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/prerender-manifest.json",
  () => require("./prerender-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./default-routes-manifest.json"),
  {
    virtual: true
  }
);

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    () => require(`../shared-fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("Lambda@Edge origin response", () => {
  let s3Client: S3Client;
  beforeEach(() => {
    s3Client = new S3Client({});
  });
  describe("Fallback pages", () => {
    it.each`
      statusCode
      ${"403"}
      ${"404"}
    `(
      "serves fallback page from S3 when S3 first returns status $statusCode",
      async ({ statusCode }) => {
        const event = createCloudFrontEvent({
          uri: "/fallback/not-yet-built.html",
          host: "mydistribution.cloudfront.net",
          config: { eventType: "origin-response" } as any,
          response: {
            headers: {},
            status: statusCode
          } as any
        });

        const result = await handler(event);
        const response = result as CloudFrontResponse;

        expect(s3Client.send).toHaveBeenCalledWith({
          Command: "GetObjectCommand",
          Bucket: "my-bucket",
          Key: "static-pages/build-id/fallback/[slug].html"
        });

        expect(response).toEqual({
          status: 200,
          statusDescription: "OK",
          headers: {
            "cache-control": [
              {
                key: "Cache-Control",
                value: "public, max-age=0, s-maxage=0, must-revalidate" // Fallback page shouldn't be cached as it will override the path for a just generated SSG page.
              }
            ],
            "content-type": [
              {
                key: "Content-Type",
                value: "text/html"
              }
            ]
          },
          body: "UzNCb2R5",
          bodyEncoding: "base64"
        });
      }
    );

    it("serves 404 page from S3 for fallback: false", async () => {
      const event = createCloudFrontEvent({
        uri: "/no-fallback/not-found.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {},
          status: "403"
        } as any
      });

      const result = await handler(event);
      const response = result as CloudFrontResponse;

      expect(s3Client.send).toHaveBeenCalledWith({
        Command: "GetObjectCommand",
        Bucket: "my-bucket",
        Key: "static-pages/build-id/404.html"
      });

      expect(response).toEqual({
        status: 404,
        statusDescription: "Not Found",
        headers: {
          "cache-control": [
            {
              key: "Cache-Control",
              value: "public, max-age=0, s-maxage=2678400, must-revalidate"
            }
          ],
          "content-type": [
            {
              key: "Content-Type",
              value: "text/html"
            }
          ]
        },
        body: "UzNCb2R5",
        bodyEncoding: "base64"
      });
    });

    it("renders and uploads HTML and JSON for fallback: blocking", async () => {
      const event = createCloudFrontEvent({
        uri: "/fallback-blocking/not-yet-built.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {},
          status: "403"
        } as any
      });

      mockPageRequire("pages/fallback-blocking/[slug].js");
      const page = require(`../../src/pages/fallback-blocking/[slug].js`);

      const response = await handler(event);

      const cfResponse = response as CloudFrontResultResponse;
      const decodedBody = Buffer.from(
        cfResponse.body as string,
        "base64"
      ).toString("utf8");

      const headers = response.headers as CloudFrontHeaders;
      expect(headers["content-type"][0].value).toEqual("text/html");
      expect(decodedBody).toEqual("<div>Rendered Page</div>");
      expect(cfResponse.status).toEqual(200);

      expect(page.renderReqToHTML.mock.calls[0][0]).toMatchObject({
        url: "/fallback-blocking/not-yet-built"
      });

      expect(s3Client.send).toHaveBeenNthCalledWith(1, {
        Command: "PutObjectCommand",
        Bucket: "my-bucket",
        Key: "_next/data/build-id/fallback-blocking/not-yet-built.json",
        Body: JSON.stringify({
          page: "pages/fallback-blocking/[slug].js"
        }),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      });
      expect(s3Client.send).toHaveBeenNthCalledWith(2, {
        Command: "PutObjectCommand",
        Bucket: "my-bucket",
        Key: "static-pages/build-id/fallback-blocking/not-yet-built.html",
        Body: "<div>Rendered Page</div>",
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      });
    });

    it("renders and uploads HTML and JSON for fallback SSG data requests", async () => {
      const event = createCloudFrontEvent({
        uri: "/_next/data/build-id/fallback/not-yet-built.json",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {
            date: [
              {
                name: "date",
                value: "Wed, 21 Apr 2021 03:47:27 GMT"
              }
            ]
          },
          status: "403"
        } as any
      });

      mockPageRequire("pages/fallback/[slug].js");
      const page = require(`../../src/pages/fallback/[slug].js`);

      const response = await handler(event);

      const cfResponse = response as CloudFrontResultResponse;
      const decodedBody = Buffer.from(
        cfResponse.body as string,
        "base64"
      ).toString("utf8");

      const headers = response.headers as CloudFrontHeaders;
      expect(headers["date"][0].value).toEqual("Wed, 21 Apr 2021 03:47:27 GMT");
      expect(headers["cache-control"][0].value).toEqual(
        "public, max-age=0, s-maxage=2678400, must-revalidate"
      );
      expect(headers["content-type"][0].value).toEqual("application/json");
      expect(JSON.parse(decodedBody)).toEqual({
        page: "pages/fallback/[slug].js"
      });
      expect(cfResponse.status).toEqual(200);

      expect(page.renderReqToHTML.mock.calls[0][0]).toMatchObject({
        url: "/_next/data/build-id/fallback/not-yet-built.json"
      });

      expect(s3Client.send).toHaveBeenNthCalledWith(1, {
        Command: "PutObjectCommand",
        Bucket: "my-bucket",
        Key: "_next/data/build-id/fallback/not-yet-built.json",
        Body: JSON.stringify({
          page: "pages/fallback/[slug].js"
        }),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      });
      expect(s3Client.send).toHaveBeenNthCalledWith(2, {
        Command: "PutObjectCommand",
        Bucket: "my-bucket",
        Key: "static-pages/build-id/fallback/not-yet-built.html",
        Body: "<div>Rendered Page</div>",
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      });
    });
  });

  describe("SSG page requests", () => {
    it("index page has correct status code", async () => {
      const event = createCloudFrontEvent({
        uri: "/index.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {},
          status: "200"
        } as any
      });

      const response = await handler(event);
      const cfResponse = response as CloudFrontResultResponse;
      expect(cfResponse.status).toBe("200");
    });
  });

  describe("SSR data requests", () => {
    it("does not upload to S3", async () => {
      const event = createCloudFrontEvent({
        uri: "/_next/data/build-id/customers/index.json",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {},
          status: "403"
        } as any
      });

      mockPageRequire("pages/customers/[customer].js");

      const response = await handler(event);

      const cfResponse = response as CloudFrontResultResponse;
      const decodedBody = Buffer.from(
        cfResponse.body as string,
        "base64"
      ).toString("utf8");

      const headers = response.headers as CloudFrontHeaders;
      expect(headers["content-type"][0].value).toEqual("application/json");
      expect(JSON.parse(decodedBody)).toEqual({
        page: "pages/customers/[customer].js"
      });
      expect(cfResponse.status).toEqual(200);
      expect(s3Client.send).not.toHaveBeenCalled();
    });
  });
});
