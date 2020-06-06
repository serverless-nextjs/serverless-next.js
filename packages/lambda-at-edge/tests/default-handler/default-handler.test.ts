import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import { CloudFrontRequest, CloudFrontResultResponse } from "aws-lambda";

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
        path                                               | expectedPage
        ${"/"}                                             | ${"/index.html"}
        ${"/index"}                                        | ${"/index.html"}
        ${"/terms"}                                        | ${"/terms.html"}
        ${"/users/batman"}                                 | ${"/users/[user].html"}
        ${"/users/test/catch/all"}                         | ${"/users/[...user].html"}
        ${"/john/123"}                                     | ${"/[username]/[id].html"}
        ${"/tests/prerender-manifest/example-static-page"} | ${"/tests/prerender-manifest/example-static-page.html"}
      `(
        "serves page $expectedPage from S3 for path $path",
        async ({ path, expectedPage }) => {
          const event = createCloudFrontEvent({
            uri: path,
            host: "mydistribution.cloudfront.net",
            origin: {
              s3: {
                authMethod: "origin-access-identity",
                domainName: "my-bucket.s3.amazonaws.com",
                path: ""
              }
            }
          });

          const request = await handler(event);

          expect(request.origin).toEqual({
            s3: {
              authMethod: "origin-access-identity",
              domainName: "my-bucket.s3.amazonaws.com",
              path: "/static-pages"
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
          host: "mydistribution.cloudfront.net",
          origin: {
            s3: {
              authMethod: "origin-access-identity",
              domainName: "my-bucket.s3.amazonaws.com",
              path: ""
            }
          }
        });

        const request = await handler(event);

        const cfRequest = request as CloudFrontRequest;
        expect(cfRequest.origin).toEqual({
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: "/public"
          }
        });
        expect(cfRequest.uri).toEqual("/manifest.json");
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
            host: "mydistribution.cloudfront.net",
            origin: {
              s3: {
                domainName: "my-bucket.amazonaws.com"
              }
            }
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          const cfResponse = response as CloudFrontResultResponse;
          const decodedBody = new Buffer(cfResponse.body, "base64").toString(
            "utf8"
          );

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
          host: "mydistribution.cloudfront.net",
          origin: {
            s3: {
              domainName: "my-bucket.amazonaws.com"
            }
          }
        });

        mockPageRequire(expectedPage);

        const response = await handler(event);

        const cfResponse = response as CloudFrontResultResponse;
        const decodedBody = new Buffer(cfResponse.body, "base64").toString(
          "utf8"
        );

        expect(cfResponse.headers["content-type"][0].value).toEqual(
          "application/json"
        );
        expect(JSON.parse(decodedBody)).toEqual({
          page: expectedPage
        });
        expect(cfResponse.status).toEqual(200);
      });
    });
  });

  it("renders 404 page if request path can't be matched to any page / api routes", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/_error.js");

    const response = (await handler(event)) as CloudFrontResultResponse;

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/_error.js");
    expect(response.status).toEqual(200);
  });
});
