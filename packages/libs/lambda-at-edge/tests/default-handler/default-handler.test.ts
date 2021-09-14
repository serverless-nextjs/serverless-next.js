import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import {
  CloudFrontRequest,
  CloudFrontResultResponse,
  CloudFrontOrigin
} from "aws-lambda";
import { isBlacklistedHeader } from "../../src/headers/removeBlacklistedHeaders";

jest.mock("node-fetch", () => require("fetch-mock-jest").sandbox());

jest.mock(
  "../../src/manifest.json",
  () => require("./default-build-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/api-manifest.json",
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  () => require("./api-build-manifest.json"),
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

jest.mock(
  "../../src/prerender-manifest.json",
  () => require("./prerender-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/images-manifest.json",
  () => require("./images-manifest.json"),
  {
    virtual: true
  }
);

jest.mock("../../src/lib/triggerStaticRegeneration", () => ({
  __esModule: true,
  triggerStaticRegeneration: jest.fn()
}));
const mockTriggerStaticRegeneration =
  require("../../src/lib/triggerStaticRegeneration").triggerStaticRegeneration;

jest.mock("../../src/s3/s3StorePage", () => ({
  __esModule: true,
  s3StorePage: jest.fn()
}));

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
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "error").mockReturnValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("HTML pages routing", () => {
    it.each`
      path               | expectedPage
      ${"/"}             | ${"/index.html"}
      ${"/terms"}        | ${"/terms.html"}
      ${"/users/batman"} | ${"/users/[...user].html"}
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
            path: "/static-pages/build-id",
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

    it("terms.html should return 200 status after successful S3 Origin response", async () => {
      const event = createCloudFrontEvent({
        uri: "/terms.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200"
        } as any
      });

      const response = (await handler(event)) as CloudFrontResultResponse;

      expect(response.status).toEqual("200");
    });
  });

  describe("Public files routing", () => {
    it.each`
      path
      ${"/manifest.json"}
      ${"/file%20with%20spaces.json"}
    `(
      "serves public file at path $path from S3 /public folder",
      async ({ path }) => {
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
            path: "/public",
            region: "us-east-1"
          }
        });
        expect(request.uri).toEqual(path);
      }
    );

    it("public file should return 200 status after successful S3 Origin response", async () => {
      const event = createCloudFrontEvent({
        uri: "/manifest.json",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200"
        } as any
      });

      const response = (await handler(event)) as CloudFrontResultResponse;

      expect(response.status).toEqual("200");
    });
  });

  describe("SSR pages routing", () => {
    it.each`
      path                              | expectedPage
      ${"/abc"}                         | ${"pages/[root].js"}
      ${"/blog/foo"}                    | ${"pages/blog/[id].js"}
      ${"/customers"}                   | ${"pages/customers.js"}
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
        const decodedBody = Buffer.from(
          cfResponse.body as string,
          "base64"
        ).toString("utf8");

        expect(decodedBody).toEqual(expectedPage);
        expect(cfResponse.status).toEqual(200);

        // Verify no blacklisted headers are present
        for (const header in response.headers) {
          expect(isBlacklistedHeader(header)).toBe(false);
        }
      }
    );
  });

  describe("Data Requests", () => {
    it.each`
      path                                                      | expectedPage
      ${"/_next/data/build-id/customers.json"}                  | ${"pages/customers.js"}
      ${"/_next/data/build-id/customers/superman.json"}         | ${"pages/customers/[customer].js"}
      ${"/_next/data/build-id/customers/superman/profile.json"} | ${"pages/customers/[customer]/profile.js"}
      ${"/_next/data/build-id/customers/test/catch/all.json"}   | ${"pages/customers/[...catchAll].js"}
    `(
      "serves json data via SSR for SSR path $path",
      async ({ path, expectedPage }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net",
          config: { eventType: "origin-request" } as any
        });

        mockPageRequire(expectedPage);

        const result = await handler(event);

        const cfResponse = result as CloudFrontResultResponse;
        const decodedBody = Buffer.from(
          cfResponse.body as string,
          "base64"
        ).toString("utf8");

        expect(decodedBody).toEqual(JSON.stringify({ page: expectedPage }));
        expect(cfResponse.status).toEqual(200);
      }
    );

    it.each`
      path                                                  | expectedUri
      ${"/_next/data/build-id"}                             | ${"/_next/data/build-id/index.json"}
      ${"/_next/data/build-id/index.json"}                  | ${"/_next/data/build-id/index.json"}
      ${"/_next/data/build-id/fallback/not-yet-built.json"} | ${"/_next/data/build-id/fallback/not-yet-built.json"}
    `(
      "serves json data via S3 for SSG path $path",
      async ({ path, expectedUri }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net",
          config: { eventType: "origin-request" } as any
        });

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
        expect(request.uri).toEqual(expectedUri);
      }
    );

    it("correctly removes the expires header if set in the response for an ssg page", async () => {
      mockTriggerStaticRegeneration.mockReturnValueOnce(
        Promise.resolve({ throttle: false })
      );

      const event = createCloudFrontEvent({
        uri: "/preview",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {
            expires: [
              {
                value: new Date().toJSON(),
                key: "Expires"
              }
            ]
          }
        }
      });

      const response = await handler(event);
      expect(mockTriggerStaticRegeneration).toBeCalledTimes(1);
      expect(mockTriggerStaticRegeneration.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          basePath: "",
          pagePath: "pages/preview.js",
          request: expect.objectContaining({
            uri: `/preview`
          })
        })
      );

      expect(response.headers).not.toHaveProperty("expires");
      expect(response.headers).not.toHaveProperty("Expires");
    });

    it("returns a correct cache control header when an expiry header in the future is sent", async () => {
      const event = createCloudFrontEvent({
        uri: "/customers",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {
            expires: [
              {
                value: new Date(new Date().getTime() + 3000).toJSON(),
                key: "Expires"
              }
            ]
          }
        }
      });

      const response = await handler(event);
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"][0].value).toBe(
        "public, max-age=0, s-maxage=3, must-revalidate"
      );
    });

    it("returns a correct cache control header when an expiry header in the past is sent", async () => {
      const event = createCloudFrontEvent({
        uri: "/customers",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {
            expires: [
              {
                value: new Date(new Date().getTime() - 3000).toJSON(),
                key: "Expires"
              }
            ]
          }
        }
      });

      const response = await handler(event);
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"][0].value).toBe(
        "public, max-age=0, s-maxage=0, must-revalidate"
      );
    });

    it("returns a correct cache control header when a last-modified header is sent", async () => {
      const event = createCloudFrontEvent({
        uri: "/preview",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {
            ["last-modified"]: [
              {
                value: new Date(new Date().getTime() - 3000).toJSON(),
                key: "Last-Modified"
              }
            ]
          }
        }
      });

      const response = await handler(event);
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"][0].value).toBe(
        "public, max-age=0, s-maxage=2, must-revalidate"
      );
    });

    it("returns a correct throttled cache header when 'throttle' value is returned true", async () => {
      mockTriggerStaticRegeneration.mockReturnValueOnce(
        Promise.resolve({ throttle: true })
      );
      const event = createCloudFrontEvent({
        uri: "/preview",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200",
          statusDescription: "ok",
          headers: {
            expires: [
              {
                key: "Expires",
                value: new Date().toJSON()
              }
            ]
          }
        }
      });

      const response = await handler(event);
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"][0].value).toBe(
        "public, max-age=0, s-maxage=1, must-revalidate"
      );
      expect(mockTriggerStaticRegeneration).toHaveBeenCalled();
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
    expect(request.headers.host[0].value).toEqual("my-bucket.s3.amazonaws.com");
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
        path: "/static-pages/build-id",
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

  describe("404 page", () => {
    it("returns 404 page if request path can't be matched to any page / api routes", async () => {
      const event = createCloudFrontEvent({
        uri: "/page/does/not/exist",
        host: "mydistribution.cloudfront.net"
      });

      const request = (await handler(event)) as CloudFrontRequest;
      expect(request.uri).toEqual("/404.html");
    });

    it.each`
      path
      ${"/_next/data/unmatched"}
    `(
      "returns 404 page if data request can't be matched for path: $path",
      async ({ path }) => {
        const event = createCloudFrontEvent({
          uri: path,
          origin: {
            s3: {
              domainName: "my-bucket.s3.amazonaws.com"
            }
          },
          config: { eventType: "origin-request" } as any
        });

        const request = (await handler(event)) as CloudFrontRequest;
        expect(request.uri).toEqual("/404.html");
      }
    );

    it("404.html should return 404 status after successful S3 Origin response", async () => {
      const event = createCloudFrontEvent({
        uri: "/404.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200"
        } as any
      });

      const response = (await handler(event)) as CloudFrontResultResponse;

      expect(response.status).toEqual("404");
    });

    it("path ending 404 should return 200 status after successful S3 Origin response", async () => {
      const event = createCloudFrontEvent({
        uri: "/fallback/404.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200"
        } as any
      });

      const response = (await handler(event)) as CloudFrontResultResponse;

      expect(response.status).toEqual("200");
    });
  });

  describe("500 page", () => {
    it("renders 500 page if page render has an error", async () => {
      const event = createCloudFrontEvent({
        uri: "/erroredPage",
        host: "mydistribution.cloudfront.net"
      });

      mockPageRequire("pages/erroredPage.js");
      mockPageRequire("pages/_error.js");

      const response = (await handler(event)) as CloudFrontResultResponse;
      const body = response.body as string;
      const decodedBody = Buffer.from(body, "base64").toString("utf8");

      expect(decodedBody).toEqual("pages/_error.js - 500");
      expect(response.status).toEqual(500);
    });

    it("path ending 500 should return 200 status after successful S3 Origin response", async () => {
      const event = createCloudFrontEvent({
        uri: "/fallback/500.html",
        host: "mydistribution.cloudfront.net",
        config: { eventType: "origin-response" } as any,
        response: {
          status: "200"
        } as any
      });

      const response = (await handler(event)) as CloudFrontResultResponse;

      expect(response.status).toEqual("200");
    });
  });

  describe("Custom Rewrites", () => {
    it.each`
      uri                    | rewriteUri                | method
      ${"/external-rewrite"} | ${"https://external.com"} | ${"GET"}
      ${"/external-rewrite"} | ${"https://external.com"} | ${"POST"}
    `(
      "serves external rewrite $rewriteUri for rewritten path $uri and method $method",
      async ({ uri, rewriteUri, method }) => {
        const { default: fetchMock } = await import("node-fetch");

        const mockFetchResponse = {
          body: "external",
          headers: {
            "Content-Type": "text/plain",
            Host: "external.com",
            "x-amz-cf-pop": "SEA19-C1"
          }, // host and x-amz-cf-pop header are blacklisted and won't be added
          status: 200
        };

        fetchMock.mock(rewriteUri, mockFetchResponse);

        let [path, querystring] = uri.split("?");

        const event = createCloudFrontEvent({
          uri: path,
          querystring: querystring,
          host: "mydistribution.cloudfront.net",
          method: method,
          body:
            method === "POST"
              ? {
                  action: "read-only",
                  data: "eyJhIjoiYiJ9",
                  encoding: "base64",
                  inputTruncated: false
                }
              : undefined
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

        expect(fetchMock).toHaveLastFetched("https://external.com", {
          method: method
        });

        fetchMock.reset();
      }
    );
  });
});
