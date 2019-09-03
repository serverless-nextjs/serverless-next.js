const { handler } = require("../lambda-at-edge-handler");
const { createCloudFrontEvent } = require("../lib/test-utils");

jest.mock("../manifest.json", () => require("./fixtures/manifest.json"), {
  virtual: true
});

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
});
