import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import {
  CloudFrontResultResponse,
  CloudFrontHeaders,
  CloudFrontResponse
} from "aws-lambda";
import S3 from "aws-sdk/clients/s3";

jest.mock("aws-sdk/clients/s3", () => require("../aws-sdk-s3.mock"));

jest.mock(
  "../../src/manifest.json",
  () => require("./default-build-manifest.json"),
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
  let s3Client: S3;
  beforeEach(() => {
    s3Client = new S3();
    (s3Client.getObject as jest.Mock).mockClear();
    (s3Client.putObject as jest.Mock).mockClear();
  });
  describe("Fallback pages", () => {
    it("serves fallback page from S3", async () => {
      const event = createCloudFrontEvent({
        uri: "/tests/prerender-manifest-fallback/not-yet-built",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "403"
        } as any
      });

      const result = await handler(event);
      const response = result as CloudFrontResponse;

      expect(s3Client.getObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: "static-pages/tests/prerender-manifest-fallback/[fallback].html"
        })
      );

      expect(response).toEqual(
        expect.objectContaining({
          status: "200",
          statusDescription: "OK",
          headers: {
            "content-type": [
              {
                key: "Content-Type",
                value: "text/html"
              }
            ]
          }
        })
      );
    });
    it("renders and uploads HTML and JSON for fallback SSG data requests", async () => {
      const event = createCloudFrontEvent({
        uri: "/_next/data/build-id/fallback/not-yet-built.json",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          headers: {},
          status: "403"
        } as any
      });

      mockPageRequire("pages/fallback/[slug].js");

      const response = await handler(event);

      const cfResponse = response as CloudFrontResultResponse;
      const decodedBody = new Buffer(
        cfResponse.body as string,
        "base64"
      ).toString("utf8");

      const headers = response.headers as CloudFrontHeaders;
      expect(headers["content-type"][0].value).toEqual("application/json");
      expect(JSON.parse(decodedBody)).toEqual({
        page: "pages/fallback/[slug].js"
      });
      expect(cfResponse.status).toEqual(200);

      expect(s3Client.putObject).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          Key: "_next/data/build-id/fallback/not-yet-built.json",
          Body: JSON.stringify({
            page: "pages/fallback/[slug].js"
          }),
          ContentType: "application/json"
        })
      );
      expect(s3Client.putObject).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          Key: "static-pages/fallback/not-yet-built.html",
          Body: "<div>Rendered Page</div>",
          ContentType: "text/html",
          CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
        })
      );
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
      const decodedBody = new Buffer(
        cfResponse.body as string,
        "base64"
      ).toString("utf8");

      const headers = response.headers as CloudFrontHeaders;
      expect(headers["content-type"][0].value).toEqual("application/json");
      expect(JSON.parse(decodedBody)).toEqual({
        page: "pages/customers/[customer].js"
      });
      expect(cfResponse.status).toEqual(200);
      expect(s3Client.putObject).not.toHaveBeenCalled();
    });
  });
});
