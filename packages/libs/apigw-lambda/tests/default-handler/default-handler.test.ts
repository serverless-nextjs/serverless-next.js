import { handler } from "../../src/default-handler";
import { createRequestEvent } from "../test-utils";
import { EventResponse } from "../../src/types";
import { runRedirectTestWithHandler } from "../utils/runRedirectTest";
import { S3Client } from "@aws-sdk/client-s3/S3Client";

jest.mock("node-fetch", () => require("fetch-mock-jest").sandbox());

const previewToken =
  "eyJhbGciOiJIUzI1NiJ9.dGVzdA.bi6AtyJgYL7FimOTVSoV6Htx9XNLe2PINsOadEDYmwI";

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
  () => require("./default-build-manifest.json"),
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

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    () => require(`../shared-fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

const s3Client = new S3Client({});

const manifest = require("../../src/manifest.json");
const tsManifest = require("./default-build-manifest-with-trailing-slash.json");
const notsManifest = { ...manifest };
const routesManifest = require("../../src/routes-manifest.json");
const tsRoutesManifest = require("./default-routes-manifest-with-trailing-slash.json");
const notsRoutesManifest = { ...routesManifest };

const runRedirectTest = async (
  path: string,
  expectedRedirect: string,
  statusCode: number,
  querystring?: string,
  host?: string,
  headers?: { key: string; value: string }
): Promise<void> => {
  await runRedirectTestWithHandler(
    handler,
    path,
    expectedRedirect,
    statusCode,
    querystring,
    host,
    headers
  );
};

describe("Lambda@Edge", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, "error").mockReturnValue();
    (s3Client.send as any).mockClear();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  describe.each`
    trailingSlash
    ${false}
    ${true}
  `("Routing with trailingSlash = $trailingSlash", ({ trailingSlash }) => {
    beforeAll(() => {
      if (trailingSlash) {
        Object.assign(manifest, tsManifest);
        Object.assign(routesManifest, tsRoutesManifest);
      } else {
        Object.assign(manifest, notsManifest);
        Object.assign(routesManifest, notsRoutesManifest);
      }
    });

    describe("HTML pages routing", () => {
      it.each`
        path                       | expectedPage
        ${"/"}                     | ${"/index.html"}
        ${"/terms"}                | ${"/terms.html"}
        ${"/users/batman"}         | ${"/users/[...user].html"}
        ${"/users/test/catch/all"} | ${"/users/[...user].html"}
      `(
        "serves page $expectedPage from S3 for path $path",
        async ({ path, expectedPage }) => {
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(200);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: `/static-pages/build-id${expectedPage}`
            })
          );
        }
      );

      it.each`
        path
        ${"/terms"}
        ${"/users/batman"}
        ${"/users/test/catch/all"}
      `(
        `path $path redirects if it ${
          trailingSlash ? "does not have" : "has"
        } a trailing slash`,
        async ({ path }) => {
          let expectedRedirect;
          if (trailingSlash) {
            expectedRedirect = path + "/";
          } else {
            expectedRedirect = path;
            path += "/";
          }
          await runRedirectTest(path, expectedRedirect, 308);
        }
      );

      it.each`
        path
        ${"//example.com"}
        ${"//example.com/"}
      `(`returns 404 without redirect for $path`, async ({ path }) => {
        const event = createRequestEvent({
          uri: path
        });

        const result = await handler(event);

        expect(result.statusCode).toEqual(404);
        expect(s3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            Command: "GetObjectCommand",
            Key: `/static-pages/build-id/404.html`
          })
        );
      });

      it("HTML page without any props served from S3 on preview mode", async () => {
        const event = createRequestEvent({
          uri: `/terms${trailingSlash ? "/" : ""}`,
          headers: {
            Cookie: `__next_preview_data=${previewToken}; __prerender_bypass=def`
          }
        });

        const result = await handler(event);

        expect(result.statusCode).toEqual(200);
        expect(s3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            Command: "GetObjectCommand",
            Key: `/static-pages/build-id/terms.html`
          })
        );
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
          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(200);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: `/public${path}`
            })
          );
        }
      );

      it.each`
        path                 | expectedRedirect
        ${"/favicon.ico/"}   | ${"/favicon.ico"}
        ${"/manifest.json/"} | ${"/manifest.json"}
      `(
        "public files always redirect to path without trailing slash: $path -> $expectedRedirect",
        async ({ path, expectedRedirect }) => {
          await runRedirectTest(path, expectedRedirect, 308);
        }
      );
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
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          const cfResponse = response as EventResponse;
          const decodedBody = Buffer.from(
            cfResponse.body as string,
            "base64"
          ).toString("utf8");

          expect(decodedBody).toEqual(expectedPage);
          expect(cfResponse.statusCode).toEqual(200);
        }
      );

      it.each`
        path
        ${"/abc"}
        ${"/blog/foo"}
        ${"/customers"}
        ${"/customers/superman"}
        ${"/customers/superman/howtofly"}
        ${"/customers/superman/profile"}
        ${"/customers/test/catch/all"}
      `(
        `path $path redirects if it ${
          trailingSlash ? "does not have" : "has"
        } trailing slash`,
        async ({ path }) => {
          let expectedRedirect;
          if (trailingSlash) {
            expectedRedirect = path + "/";
          } else {
            expectedRedirect = path;
            path += "/";
          }
          await runRedirectTest(path, expectedRedirect, 308);
        }
      );

      it.each`
        path
        ${"/abc"}
        ${"/blog/foo"}
        ${"/customers"}
        ${"/customers/superman"}
        ${"/customers/superman/howtofly"}
        ${"/customers/superman/profile"}
        ${"/customers/test/catch/all"}
      `("path $path passes querystring to redirected URL", async ({ path }) => {
        const querystring = "a=1&b=2";

        let expectedRedirect;
        if (trailingSlash) {
          expectedRedirect = `${path}/?${querystring}`;
        } else {
          expectedRedirect = `${path}?${querystring}`;
          path += "/";
        }

        await runRedirectTest(path, expectedRedirect, 308, querystring);
      });
    });

    describe("SSG page routing", () => {
      it.each`
        path                                  | expectedPage
        ${"/fallback/not-yet-built"}          | ${"/fallback/not-yet-built.html"}
        ${"/fallback-blocking/not-yet-built"} | ${"/fallback-blocking/not-yet-built.html"}
        ${"/no-fallback/example-static-page"} | ${"/no-fallback/example-static-page.html"}
        ${"/preview"}                         | ${"/preview.html"}
      `(
        "serves page $expectedPage from S3 for path $path",
        async ({ path, expectedPage }) => {
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(200);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: `/static-pages/build-id${expectedPage}`
            })
          );
        }
      );

      it("handles preview mode", async () => {
        const event = createRequestEvent({
          uri: `/preview${trailingSlash ? "/" : ""}`,
          headers: {
            Cookie: `__next_preview_data=${previewToken}; __prerender_bypass=def`
          }
        });

        mockPageRequire("pages/preview.js");

        const response = await handler(event);
        const decodedBody = Buffer.from(
          response.body as string,
          "base64"
        ).toString("utf8");
        expect(decodedBody).toBe("pages/preview.js");
        expect(response.statusCode).toBe(200);
      });

      describe("dynamic fallback", () => {
        beforeEach(() => {
          (s3Client as any).fail(1);
        });

        afterAll(() => {
          (s3Client as any).fail(0);
        });

        it.each`
          path                                  | statusCode | expectedPage
          ${"/fallback/not-yet-built"}          | ${200}     | ${"/fallback/[slug].html"}
          ${"/no-fallback/example-static-page"} | ${404}     | ${"/404.html"}
        `(
          "serves $expectedPage for path $path when page is not found",
          async ({ path, expectedPage, statusCode }) => {
            // If trailingSlash = true, append "/" to get the non-redirected path
            if (trailingSlash && !path.endsWith("/")) {
              path += "/";
            }

            const event = createRequestEvent({
              uri: path
            });

            const result = await handler(event);

            expect(result.statusCode).toEqual(statusCode);
            expect(s3Client.send).toHaveBeenLastCalledWith(
              expect.objectContaining({
                Command: "GetObjectCommand",
                Key: `/static-pages/build-id${expectedPage}`
              })
            );
          }
        );

        it.each`
          path                                  | expectedPage
          ${"/fallback-blocking/not-yet-built"} | ${"pages/fallback-blocking/[slug].js"}
        `(
          "renders $expectedPage for path $path when page is not found",
          async ({ path, expectedPage }) => {
            // If trailingSlash = true, append "/" to get the non-redirected path
            if (trailingSlash && !path.endsWith("/")) {
              path += "/";
            }

            const event = createRequestEvent({
              uri: path
            });

            mockPageRequire(expectedPage);

            const response = await handler(event);

            const decodedBody = Buffer.from(
              response.body as string,
              "base64"
            ).toString("utf8");
            expect(decodedBody).toBe("<div>Rendered Page</div>");
            expect(response.statusCode).toBe(200);
          }
        );
      });
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
          const event = createRequestEvent({
            uri: path
          });

          mockPageRequire(expectedPage);

          const result = await handler(event);

          const cfResponse = result as EventResponse;
          const decodedBody = Buffer.from(
            cfResponse.body as string,
            "base64"
          ).toString("utf8");

          expect(decodedBody).toEqual(JSON.stringify({ page: expectedPage }));
          expect(cfResponse.statusCode).toEqual(200);
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
          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(200);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: expectedUri
            })
          );
        }
      );

      /*
      it("correctly removes the expires header if set in the response for an ssg page", async () => {
        mockTriggerStaticRegeneration.mockReturnValueOnce(
          Promise.resolve({ throttle: false })
        );

        const event = createRequestEvent({
          uri: "/preview",
        });

        const response = await handler(event);
        expect(mockTriggerStaticRegeneration).toBeCalledTimes(1);
        expect(mockTriggerStaticRegeneration.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            basePath: "",
            pagePath: "pages/preview.js",
            request: expect.objectContaining({
              uri: `/preview${trailingSlash ? "/" : ""}`
            })
          })
        );

        expect(response.headers).not.toHaveProperty("expires");
        expect(response.headers).not.toHaveProperty("Expires");
      });

      it("returns a correct cache control header when an expiry header in the future is sent", async () => {
        const event = createRequestEvent({
          uri: "/customers",
        });

        const response = await handler(event);
        expect(response.headers).toHaveProperty("cache-control");
        expect(response.headers["cache-control"][0].value).toBe(
          "public, max-age=0, s-maxage=3, must-revalidate"
        );
      });

      it("returns a correct cache control header when an expiry header in the past is sent", async () => {
        mockTriggerStaticRegeneration.mockReturnValueOnce(
          Promise.resolve({ throttle: false })
        );
        const event = createRequestEvent({
          uri: "/customers",
        });

        const response = await handler(event);
        expect(response.headers).toHaveProperty("cache-control");
        expect(response.headers["cache-control"][0].value).toBe(
          "public, max-age=0, s-maxage=0, must-revalidate"
        );
      });

      it("returns a correct cache control header when a last-modified header is sent", async () => {
        mockTriggerStaticRegeneration.mockReturnValueOnce(
          Promise.resolve({ throttle: false })
        );
        const event = createRequestEvent({
          uri: "/preview",
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
        const event = createRequestEvent({
          uri: "/preview",
        });

        const response = await handler(event);
        expect(response.headers).toHaveProperty("cache-control");
        expect(response.headers["cache-control"][0].value).toBe(
          "public, max-age=0, s-maxage=1, must-revalidate"
        );
      });*/

      it.each`
        path                                                       | expectedRedirect
        ${"/_next/data/build-id/"}                                 | ${"/_next/data/build-id"}
        ${"/_next/data/build-id/index.json/"}                      | ${"/_next/data/build-id/index.json"}
        ${"/_next/data/build-id/customers.json/"}                  | ${"/_next/data/build-id/customers.json"}
        ${"/_next/data/build-id/customers/superman.json/"}         | ${"/_next/data/build-id/customers/superman.json"}
        ${"/_next/data/build-id/customers/superman/profile.json/"} | ${"/_next/data/build-id/customers/superman/profile.json"}
      `(
        "data requests always redirect to path without trailing slash: $path -> $expectedRedirect",
        async ({ path, expectedRedirect }) => {
          await runRedirectTest(path, expectedRedirect, 308);
        }
      );

      it("handles preview mode", async () => {
        const event = createRequestEvent({
          uri: "/_next/data/build-id/preview.json",
          headers: {
            Cookie: `__next_preview_data=${previewToken}; __prerender_bypass=def`
          }
        });

        mockPageRequire("/pages/preview.js");
        const result = await handler(event);
        const response = result as EventResponse;
        const decodedBody = Buffer.from(
          response.body as string,
          "base64"
        ).toString("utf8");
        expect(decodedBody).toBe(
          JSON.stringify({
            page: "pages/preview.js"
          })
        );
        expect(response.statusCode).toBe(200);
      });
    });

    describe("S3 requests", () => {
      it("use default s3 endpoint when region is undefined", async () => {
        expect(s3Client.config.region).toBeUndefined();
      });
    });

    describe("404 page", () => {
      it("returns 404 page if request path can't be matched to any page / api routes", async () => {
        const event = createRequestEvent({
          uri: trailingSlash ? "/page/does/not/exist/" : "/page/does/not/exist"
        });

        const result = await handler(event);

        expect(result.statusCode).toEqual(404);
        expect(s3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            Command: "GetObjectCommand",
            Key: "/static-pages/build-id/404.html"
          })
        );
      });

      it("redirects unmatched request path", async () => {
        let path = "/page/does/not/exist";
        let expectedRedirect;
        if (trailingSlash) {
          expectedRedirect = path + "/";
        } else {
          expectedRedirect = path;
          path += "/";
        }
        await runRedirectTest(path, expectedRedirect, 308);
      });

      it.each`
        path
        ${"/_next/data/unmatched"}
      `(
        "returns 404 page if data request can't be matched for path: $path",
        async ({ path }) => {
          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(404);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: "/static-pages/build-id/404.html"
            })
          );
        }
      );
    });

    describe("500 page", () => {
      it("renders 500 page if page render has an error", async () => {
        const event = createRequestEvent({
          uri: trailingSlash ? "/erroredPage/" : "/erroredPage"
        });

        mockPageRequire("pages/erroredPage.js");
        mockPageRequire("pages/_error.js");

        const response = (await handler(event)) as EventResponse;
        const body = response.body as string;
        const decodedBody = Buffer.from(body, "base64").toString("utf8");

        expect(decodedBody).toEqual("pages/_error.js - 500");
        expect(response.statusCode).toEqual(500);
      });
    });

    describe("Custom Redirects", () => {
      if (trailingSlash) {
        it.each`
          uri                                  | expectedRedirect         | expectedRedirectStatusCode
          ${"/terms-new/"}                     | ${"/terms/"}             | ${308}
          ${"/old-blog/abc/"}                  | ${"/news/abc/"}          | ${308}
          ${"/old-users/1234/"}                | ${"/users/1234/"}        | ${307}
          ${"/external/"}                      | ${"https://example.com"} | ${308}
          ${"/terms-redirect-dest-query/"}     | ${"/terms/?foo=bar"}     | ${308}
          ${"/terms-redirect-dest-query/?a=b"} | ${"/terms/?a=b&foo=bar"} | ${308}
        `(
          "redirects path $uri to $expectedRedirect, expectedRedirectStatusCode: $expectedRedirectStatusCode",
          async ({ uri, expectedRedirect, expectedRedirectStatusCode }) => {
            const [path, querystring] = uri.split("?");

            await runRedirectTest(
              path,
              expectedRedirect,
              expectedRedirectStatusCode,
              querystring
            );
          }
        );
      } else {
        it.each`
          uri                                 | expectedRedirect         | expectedRedirectStatusCode
          ${"/terms-new"}                     | ${"/terms"}              | ${308}
          ${"/old-blog/abc"}                  | ${"/news/abc"}           | ${308}
          ${"/old-users/1234"}                | ${"/users/1234"}         | ${307}
          ${"/external"}                      | ${"https://example.com"} | ${308}
          ${"/terms-redirect-dest-query"}     | ${"/terms?foo=bar"}      | ${308}
          ${"/terms-redirect-dest-query?a=b"} | ${"/terms?a=b&foo=bar"}  | ${308}
        `(
          "redirects path $uri to $expectedRedirect, expectedRedirectStatusCode: $expectedRedirectStatusCode",
          async ({ uri, expectedRedirect, expectedRedirectStatusCode }) => {
            const [path, querystring] = uri.split("?");

            await runRedirectTest(
              path,
              expectedRedirect,
              expectedRedirectStatusCode,
              querystring
            );
          }
        );
      }
    });

    describe("Domain Redirects", () => {
      it.each`
        path        | querystring | expectedRedirect                     | expectedRedirectStatusCode
        ${"/"}      | ${""}       | ${"https://www.example.com/"}        | ${308}
        ${"/"}      | ${"a=1234"} | ${"https://www.example.com/?a=1234"} | ${308}
        ${"/terms"} | ${""}       | ${"https://www.example.com/terms"}   | ${308}
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

    describe("Custom Rewrites", () => {
      it.each`
        uri                                | expectedPage
        ${"/terms"}                        | ${"/terms.html"}
        ${"/index-rewrite"}                | ${"/index.html"}
        ${"/terms-rewrite"}                | ${"/terms.html"}
        ${"/path-rewrite/123"}             | ${"/terms.html"}
        ${"/terms-rewrite-dest-query?a=b"} | ${"/terms.html"}
      `(
        "serves page $expectedPage from S3 for rewritten path $uri",
        async ({ uri, expectedPage }) => {
          let [path, querystring] = uri.split("?");

          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path,
            querystring: querystring
          });

          const result = await handler(event);

          expect(result.statusCode).toEqual(200);
          expect(s3Client.send).toHaveBeenCalledWith(
            expect.objectContaining({
              Command: "GetObjectCommand",
              Key: `/static-pages/build-id${expectedPage}`
            })
          );
        }
      );

      it.each`
        uri                    | rewriteUri                | method
        ${"/external-rewrite"} | ${"https://external.com"} | ${"GET"}
        ${"/external-rewrite"} | ${"https://external.com"} | ${"POST"}
      `(
        "serves external rewrite $rewriteUri for rewritten path $uri and method $method",
        async ({ uri, rewriteUri, method }) => {
          const { default: fetchMock } = await import("node-fetch");

          fetchMock.reset();
          fetchMock.mock(rewriteUri, "external");

          let [path, querystring] = uri.split("?");

          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path,
            querystring: querystring,
            method: method,
            body: "eyJhIjoiYiJ9",
            isBase64Encoded: true
          });

          const response: EventResponse = await handler(event);

          expect(fetchMock).toHaveLastFetched("https://external.com", {
            method: method
          });
          expect(response).toEqual({
            body: "ZXh0ZXJuYWw=",
            isBase64Encoded: true,
            headers: {
              "content-length": "8",
              "content-type": "text/plain;charset=UTF-8"
            },
            statusCode: 200
          });

          expect(fetchMock).toHaveLastFetched("https://external.com", {
            method: method
          });
        }
      );
    });

    describe("Custom Rewrites pass correct Request URL to page render", () => {
      it.each`
        path               | expectedPage
        ${"/promise-page"} | ${"pages/async-page.js"}
      `(
        "serves page $expectedPage for rewritten path $path with correct request url",
        async ({ path, expectedPage }) => {
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          mockPageRequire(expectedPage);
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const page = require(`../../src/${expectedPage}`);
          const event = createRequestEvent({
            uri: path
          });

          const result = await handler(event);
          const call = page.render.mock.calls[0];
          const firstArgument = call[0];
          expect(firstArgument).toMatchObject({ url: path });
          const decodedBody = Buffer.from(
            result.body as string,
            "base64"
          ).toString("utf8");
          expect(decodedBody).toEqual(expectedPage);
        }
      );
    });

    describe("Custom Headers", () => {
      it.each`
        path                    | expectedHeaders                    | expectedPage
        ${"/customers/another"} | ${{ "x-custom-header": "custom" }} | ${"pages/customers/[customer].js"}
      `(
        "has custom headers $expectedHeaders and expectedPage $expectedPage for path $path",
        async ({ path, expectedHeaders, expectedPage }) => {
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
          }

          const event = createRequestEvent({
            uri: path
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          expect(response.headers).toEqual(
            expect.objectContaining(expectedHeaders)
          );
        }
      );
    });
  });
});
