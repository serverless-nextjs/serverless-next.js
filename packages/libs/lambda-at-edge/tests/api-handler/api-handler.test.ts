import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/api-handler";
import { CloudFrontResponseResult } from "next-aws-cloudfront/node_modules/@types/aws-lambda";
import { CloudFrontResultResponse } from "aws-lambda";

// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock("node-fetch", () => require("fetch-mock-jest").sandbox());

jest.mock(
  "../../src/manifest.json",
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  () => require("./api-build-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  () => require("./api-routes-manifest.json"),
  {
    virtual: true
  }
);

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    () => require(`../shared-fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("API lambda handler", () => {
  describe("API routes", () => {
    it("serves api request", async () => {
      const event = createCloudFrontEvent({
        uri: "/api/getCustomers",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            domainName: "my-bucket.s3.amazonaws.com"
          }
        }
      });

      mockPageRequire("pages/api/getCustomers.js");

      const response = (await handler(event)) as CloudFrontResponseResult;

      const decodedBody = Buffer.from(response.body, "base64").toString("utf8");

      expect(decodedBody).toEqual("pages/api/getCustomers");
      expect(response.status).toEqual(200);
    });

    it("serves dynamic api request", async () => {
      const event = createCloudFrontEvent({
        uri: "/api/users/123",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            domainName: "my-bucket.s3.amazonaws.com"
          }
        }
      });

      mockPageRequire("pages/api/users/[id].js");

      const response = (await handler(event)) as CloudFrontResponseResult;

      const decodedBody = Buffer.from(response.body, "base64").toString("utf8");

      expect(decodedBody).toEqual("pages/api/[id]");
      expect(response.status).toEqual(200);
    });

    it("returns 404 for not-found api routes", async () => {
      const event = createCloudFrontEvent({
        uri: "/foo/bar",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            domainName: "my-bucket.s3.amazonaws.com"
          }
        }
      });

      mockPageRequire("pages/api/getCustomers.js");

      const response = (await handler(event)) as CloudFrontResponseResult;

      expect(response.status).toEqual(404);
    });
  });

  describe("Custom Rewrites", () => {
    it.each`
      uri                        | rewriteUri
      ${"/api/external-rewrite"} | ${"https://external.com"}
    `(
      "serves external rewrite $rewriteUri for rewritten path $uri",
      async ({ uri, rewriteUri }) => {
        const { default: fetchMock } = await import("node-fetch");
        fetchMock.get(rewriteUri, {
          body: "external",
          headers: { "Content-Type": "text/plain" },
          status: 200
        });

        const [path, querystring] = uri.split("?");

        const event = createCloudFrontEvent({
          uri: path,
          querystring: querystring,
          host: "mydistribution.cloudfront.net"
        });

        const response: CloudFrontResultResponse = await handler(event);

        expect(response).toEqual({
          body: "ZXh0ZXJuYWw=",
          bodyEncoding: "base64",
          headers: {
            "content-type": [
              {
                key: "content-type",
                value: "text/plain"
              }
            ]
          },
          status: 200,
          statusDescription: "OK"
        });

        fetchMock.reset();
      }
    );
  });
});
