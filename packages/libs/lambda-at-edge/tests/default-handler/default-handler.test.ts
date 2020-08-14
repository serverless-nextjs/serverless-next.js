import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import {
  CloudFrontRequest,
  CloudFrontResultResponse,
  CloudFrontOrigin
} from "aws-lambda";

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

describe("Lambda@Edge", () => {
  describe("Routing", () => {
    describe("HTML pages routing", () => {
      it.each`
        path                                                  | expectedPage
        ${"/"}                                                | ${"/index.html"}
        ${"/index"}                                           | ${"/index.html"}
        ${"/terms"}                                           | ${"/terms.html"}
        ${"/users/batman"}                                    | ${"/users/[user].html"}
        ${"/users/test/catch/all"}                            | ${"/users/[...user].html"}
        ${"/john/123"}                                        | ${"/[username]/[id].html"}
        ${"/tests/prerender-manifest/example-static-page"}    | ${"/tests/prerender-manifest/example-static-page.html"}
        ${"/tests/prerender-manifest-fallback/not-yet-built"} | ${"/tests/prerender-manifest-fallback/not-yet-built.html"}
      `(
        "serves page $expectedPage from S3 for path $path",
        async ({ path, expectedPage }) => {
          const event = createCloudFrontEvent({
            uri: path,
            host: "mydistribution.cloudfront.net"
          });

          const result = await handler(event);

          const request = result as CloudFrontRequest;

          expect(request.origin).toEqual({
            s3: {
              authMethod: "origin-access-identity",
              domainName: "my-bucket.s3.amazonaws.com",
              path: "/static-pages",
              region: "us-east-1"
            }
          });
          expect(request.uri).toEqual(expectedPage);
          expect(request.headers.host[0].key).toEqual("host");
          expect(request.headers.host[0].value).toEqual(
            "my-bucket.s3.amazonaws.com"
          );
        }
      );
    });

    describe("Public files routing", () => {
      it("serves public file from S3 /public folder", async () => {
        const event = createCloudFrontEvent({
          uri: "/manifest.json",
          host: "mydistribution.cloudfront.net"
        });

        const result = await handler(event);

        const request = result as CloudFrontRequest;

        expect(request.origin).toEqual({
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: "/public",
            region: "us-east-1"
          }
        });
        expect(request.uri).toEqual("/manifest.json");
      });
    });

    describe("SSR pages routing", () => {
      it.each`
        path                              | expectedPage
        ${"/abc"}                         | ${"pages/[root].js"}
        ${"/blog/foo"}                    | ${"pages/blog/[id].js"}
        ${"/customers"}                   | ${"pages/customers/index.js"}
        ${"/customers/superman"}          | ${"pages/customers/[customer].js"}
        ${"/customers/superman/howtofly"} | ${"pages/customers/[customer]/[post].js"}
        ${"/customers/superman/profile"}  | ${"pages/customers/[customer]/profile.js"}
        ${"/customers/test/catch/all"}    | ${"pages/customers/[...catchAll].js"}
      `(
        "renders page $expectedPage for path $path",
        async ({ path, expectedPage }) => {
          const event = createCloudFrontEvent({
            uri: path,
            host: "mydistribution.cloudfront.net"
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          const cfResponse = response as CloudFrontResultResponse;
          const decodedBody = new Buffer(
            cfResponse.body as string,
            "base64"
          ).toString("utf8");

          expect(decodedBody).toEqual(expectedPage);
          expect(cfResponse.status).toEqual(200);
        }
      );
    });

    describe("Data Requests", () => {
      it.each`
        path                                                      | expectedPage
        ${"/_next/data/build-id/customers.json"}                  | ${"pages/customers/index.js"}
        ${"/_next/data/build-id/customers/superman.json"}         | ${"pages/customers/[customer].js"}
        ${"/_next/data/build-id/customers/superman/profile.json"} | ${"pages/customers/[customer]/profile.js"}
      `("serves json data for path $path", async ({ path, expectedPage }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net"
        });

        mockPageRequire(expectedPage);

        const result = await handler(event);

        const request = result as CloudFrontRequest;

        expect(request.origin).toEqual({
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: "",
            region: "us-east-1"
          }
        });
        expect(request.uri).toEqual(path);
      });
    });

    it("uses default s3 endpoint when bucket region is us-east-1", async () => {
      const event = createCloudFrontEvent({
        uri: "/terms",
        host: "mydistribution.cloudfront.net",
        s3Region: "us-east-1"
      });

      const result = await handler(event);

      const request = result as CloudFrontRequest;
      const origin = request.origin as CloudFrontOrigin;

      expect(origin.s3).toEqual(
        expect.objectContaining({
          domainName: "my-bucket.s3.amazonaws.com"
        })
      );
      expect(request.headers.host[0].key).toEqual("host");
      expect(request.headers.host[0].value).toEqual(
        "my-bucket.s3.amazonaws.com"
      );
    });

    it("uses regional endpoint for static page when bucket region is not us-east-1", async () => {
      const event = createCloudFrontEvent({
        uri: "/terms",
        host: "mydistribution.cloudfront.net",
        s3DomainName: "my-bucket.s3.amazonaws.com",
        s3Region: "eu-west-1"
      });

      const result = await handler(event);

      const request = result as CloudFrontRequest;
      const origin = request.origin as CloudFrontOrigin;

      expect(origin).toEqual({
        s3: {
          authMethod: "origin-access-identity",
          domainName: "my-bucket.s3.eu-west-1.amazonaws.com",
          path: "/static-pages",
          region: "eu-west-1"
        }
      });
      expect(request.uri).toEqual("/terms.html");
      expect(request.headers.host[0].key).toEqual("host");
      expect(request.headers.host[0].value).toEqual(
        "my-bucket.s3.eu-west-1.amazonaws.com"
      );
    });

    it("uses regional endpoint for public asset when bucket region is not us-east-1", async () => {
      const event = createCloudFrontEvent({
        uri: "/favicon.ico",
        host: "mydistribution.cloudfront.net",
        s3DomainName: "my-bucket.s3.amazonaws.com",
        s3Region: "eu-west-1"
      });

      const result = await handler(event);

      const request = result as CloudFrontRequest;
      const origin = request.origin as CloudFrontOrigin;

      expect(origin).toEqual({
        s3: {
          authMethod: "origin-access-identity",
          domainName: "my-bucket.s3.eu-west-1.amazonaws.com",
          path: "/public",
          region: "eu-west-1"
        }
      });
      expect(request.uri).toEqual("/favicon.ico");
      expect(request.headers.host[0].key).toEqual("host");
      expect(request.headers.host[0].value).toEqual(
        "my-bucket.s3.eu-west-1.amazonaws.com"
      );
    });
  });

  it("renders 404 page if request path can't be matched to any page / api routes", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net"
    });

    mockPageRequire("pages/_error.js");

    const response = (await handler(event)) as CloudFrontResultResponse;
    const body = response.body as string;
    const decodedBody = new Buffer(body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/_error.js");
    expect(response.status).toEqual(200);
  });
});
