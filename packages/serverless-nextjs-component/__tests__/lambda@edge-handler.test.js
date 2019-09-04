const { handler } = require("../lambda-at-edge-handler");
const { createCloudFrontEvent } = require("../lib/test-utils");

jest.mock("../manifest.json", () => require("./fixtures/manifest.json"), {
  virtual: true
});

const mockPageRequire = mockPagePath => {
  jest.mock(
    `../${mockPagePath}`,
    () => require(`./fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("Lambda@Edge", () => {
  describe("Routing", () => {
    it("serves optimised page from S3 static-pages folder", async () => {
      const event = createCloudFrontEvent({
        uri: "/terms",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: ""
          }
        }
      });

      const request = await handler(event, {});

      expect(request.origin).toEqual({
        s3: {
          authMethod: "origin-access-identity",
          domainName: "my-bucket.s3.amazonaws.com",
          path: "/static-pages"
        }
      });
      expect(request.uri).toEqual("/terms.html");
    });

    it("serves public file from S3 /public folder", async () => {
      const event = createCloudFrontEvent({
        uri: "/manifest.json",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: ""
          }
        }
      });

      const request = await handler(event, {});

      expect(request.origin).toEqual({
        s3: {
          authMethod: "origin-access-identity",
          domainName: "my-bucket.s3.amazonaws.com",
          path: "/public"
        }
      });
      expect(request.uri).toEqual("/manifest.json");
    });
  });

  describe("When SSR@Edge is enabled", () => {
    it("renders page at the edge", async () => {
      const event = createCloudFrontEvent({
        uri: "/customers",
        host: "mydistribution.cloudfront.net",
        origin: {
          ssr: {
            domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
          }
        }
      });

      mockPageRequire("pages/customers/index.js");

      const response = await handler(event, {});

      const decodedBody = new Buffer(response.body, "base64").toString("utf8");

      expect(decodedBody).toEqual("pages/customers/index.js");
      expect(response.status).toEqual(200);
    });

    it("serves api request at the edge", async () => {
      const event = createCloudFrontEvent({
        uri: "/api/getCustomers",
        host: "mydistribution.cloudfront.net",
        origin: {
          ssr: {
            domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
          }
        }
      });

      mockPageRequire("pages/api/getCustomers.js");

      const response = await handler(event, {});

      const decodedBody = new Buffer(response.body, "base64").toString("utf8");

      expect(decodedBody).toEqual("pages/api/getCustomers");
      expect(response.status).toEqual(200);
    });
  });
});
