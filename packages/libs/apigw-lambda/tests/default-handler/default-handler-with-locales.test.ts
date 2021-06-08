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
  () => require("./default-build-manifest-with-locales.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./default-routes-manifest-with-locales.json"),
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
const tsManifest = require("./default-build-manifest-with-locales-with-trailing-slash.json");
const notsManifest = { ...manifest };
const routesManifest = require("../../src/routes-manifest.json");
const tsRoutesManifest = require("./default-routes-manifest-with-locales-with-trailing-slash.json");
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
        path                          | expectedPage
        ${"/"}                        | ${"/en.html"}
        ${"/terms"}                   | ${"/en/terms.html"}
        ${"/users/batman"}            | ${"/en/users/[...user].html"}
        ${"/users/test/catch/all"}    | ${"/en/users/[...user].html"}
        ${"/en"}                      | ${"/en.html"}
        ${"/en/terms"}                | ${"/en/terms.html"}
        ${"/en/users/batman"}         | ${"/en/users/[...user].html"}
        ${"/en/users/test/catch/all"} | ${"/en/users/[...user].html"}
        ${"/nl"}                      | ${"/nl.html"}
        ${"/nl/terms"}                | ${"/nl/terms.html"}
        ${"/nl/users/batman"}         | ${"/nl/users/[...user].html"}
        ${"/nl/users/test/catch/all"} | ${"/nl/users/[...user].html"}
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
            Key: `/static-pages/build-id/en/404.html`
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
            Key: `/static-pages/build-id/en/terms.html`
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
        path                                 | expectedPage
        ${"/abc"}                            | ${"pages/[root].js"}
        ${"/blog/foo"}                       | ${"pages/blog/[id].js"}
        ${"/customers"}                      | ${"pages/customers.js"}
        ${"/customers/superman"}             | ${"pages/customers/[customer].js"}
        ${"/customers/superman/howtofly"}    | ${"pages/customers/[customer]/[post].js"}
        ${"/customers/superman/profile"}     | ${"pages/customers/[customer]/profile.js"}
        ${"/customers/test/catch/all"}       | ${"pages/customers/[...catchAll].js"}
        ${"/en/abc"}                         | ${"pages/[root].js"}
        ${"/en/blog/foo"}                    | ${"pages/blog/[id].js"}
        ${"/en/customers"}                   | ${"pages/customers.js"}
        ${"/en/customers/superman"}          | ${"pages/customers/[customer].js"}
        ${"/en/customers/superman/howtofly"} | ${"pages/customers/[customer]/[post].js"}
        ${"/en/customers/superman/profile"}  | ${"pages/customers/[customer]/profile.js"}
        ${"/en/customers/test/catch/all"}    | ${"pages/customers/[...catchAll].js"}
        ${"/nl/abc"}                         | ${"pages/[root].js"}
        ${"/nl/blog/foo"}                    | ${"pages/blog/[id].js"}
        ${"/nl/customers"}                   | ${"pages/customers.js"}
        ${"/nl/customers/superman"}          | ${"pages/customers/[customer].js"}
        ${"/nl/customers/superman/howtofly"} | ${"pages/customers/[customer]/[post].js"}
        ${"/nl/customers/superman/profile"}  | ${"pages/customers/[customer]/profile.js"}
        ${"/nl/customers/test/catch/all"}    | ${"pages/customers/[...catchAll].js"}
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
        path                                     | expectedPage
        ${"/fallback/not-yet-built"}             | ${"/en/fallback/not-yet-built.html"}
        ${"/fallback-blocking/not-yet-built"}    | ${"/en/fallback-blocking/not-yet-built.html"}
        ${"/no-fallback/example-static-page"}    | ${"/en/no-fallback/example-static-page.html"}
        ${"/preview"}                            | ${"/en/preview.html"}
        ${"/en/fallback/not-yet-built"}          | ${"/en/fallback/not-yet-built.html"}
        ${"/en/fallback-blocking/not-yet-built"} | ${"/en/fallback-blocking/not-yet-built.html"}
        ${"/en/no-fallback/example-static-page"} | ${"/en/no-fallback/example-static-page.html"}
        ${"/en/preview"}                         | ${"/en/preview.html"}
        ${"/nl/fallback/not-yet-built"}          | ${"/nl/fallback/not-yet-built.html"}
        ${"/nl/fallback-blocking/not-yet-built"} | ${"/nl/fallback-blocking/not-yet-built.html"}
        ${"/nl/no-fallback/example-static-page"} | ${"/nl/no-fallback/example-static-page.html"}
        ${"/nl/preview"}                         | ${"/nl/preview.html"}
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
          path                                     | statusCode | expectedPage
          ${"/fallback/not-yet-built"}             | ${200}     | ${"/en/fallback/[slug].html"}
          ${"/no-fallback/example-static-page"}    | ${404}     | ${"/en/404.html"}
          ${"/en/fallback/not-yet-built"}          | ${200}     | ${"/en/fallback/[slug].html"}
          ${"/en/no-fallback/example-static-page"} | ${404}     | ${"/en/404.html"}
          ${"/nl/fallback/not-yet-built"}          | ${200}     | ${"/nl/fallback/[slug].html"}
          ${"/nl/no-fallback/example-static-page"} | ${404}     | ${"/nl/404.html"}
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
          path                                     | expectedPage
          ${"/fallback-blocking/not-yet-built"}    | ${"pages/fallback-blocking/[slug].js"}
          ${"/en/fallback-blocking/not-yet-built"} | ${"pages/fallback-blocking/[slug].js"}
          ${"/nl/fallback-blocking/not-yet-built"} | ${"pages/fallback-blocking/[slug].js"}
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

        it.each`
          path                                     | expectedPage
          ${"/fallback-blocking/not-yet-built"}    | ${"pages/fallback-blocking/[slug].js"}
          ${"/en/fallback-blocking/not-yet-built"} | ${"pages/fallback-blocking/[slug].js"}
          ${"/nl/fallback-blocking/not-yet-built"} | ${"pages/fallback-blocking/[slug].js"}
        `("Uploads page for $path", async ({ path, expectedPage }) => {
          const withTrailingSlash = path + (trailingSlash ? "/" : "");

          const event = createRequestEvent({
            uri: withTrailingSlash
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          expect(response.statusCode).toBe(200);

          const page = path.replace(/^\/f/, "/en/f");
          expect(s3Client.send).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
              Command: "PutObjectCommand",
              Key: `_next/data/build-id/pages${page}.json`,
              ContentType: "application/json"
            })
          );
          expect(s3Client.send).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({
              Command: "PutObjectCommand",
              Key: `static-pages/build-id/pages${page}.html`,
              ContentType: "text/html"
            })
          );
        });
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
        ${"/_next/data/build-id"}                             | ${"/_next/data/build-id/en.json"}
        ${"/_next/data/build-id/index.json"}                  | ${"/_next/data/build-id/en.json"}
        ${"/_next/data/build-id/fallback/not-yet-built.json"} | ${"/_next/data/build-id/en/fallback/not-yet-built.json"}
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

      describe("dynamic fallback", () => {
        beforeEach(() => {
          (s3Client as any).fail(1);
        });

        afterAll(() => {
          (s3Client as any).fail(0);
        });

        it.each`
          path                                                     | expectedPage
          ${"/_next/data/build-id/en/fallback/not-yet-built.json"} | ${"pages/fallback/[slug].js"}
          ${"/_next/data/build-id/en/fallback-blocking/foo.json"}  | ${"pages/fallback-blocking/[slug].js"}
          ${"/_next/data/build-id/nl/fallback/not-yet-built.json"} | ${"pages/fallback/[slug].js"}
          ${"/_next/data/build-id/nl/fallback-blocking/foo.json"}  | ${"pages/fallback-blocking/[slug].js"}
        `("Uploads page for $path", async ({ path, expectedPage }) => {
          const event = createRequestEvent({
            uri: path
          });

          mockPageRequire(expectedPage);

          const response = await handler(event);

          expect(response.statusCode).toBe(200);

          const page = path
            .replace("/_next/data/build-id", "")
            .replace(".json", "");
          expect(s3Client.send).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
              Command: "PutObjectCommand",
              Key: `_next/data/build-id${page}.json`,
              ContentType: "application/json"
            })
          );
          expect(s3Client.send).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({
              Command: "PutObjectCommand",
              Key: `static-pages/build-id${page}.html`,
              ContentType: "text/html"
            })
          );
        });
      });
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

      it("handles preview mode with locale", async () => {
        const event = createRequestEvent({
          uri: "/_next/data/build-id/nl/preview.json",
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
            Key: "/static-pages/build-id/en/404.html"
          })
        );
      });

      it("returns localized 404 page if localized request path can't be matched to any page / api routes", async () => {
        const event = createRequestEvent({
          uri: trailingSlash
            ? "/nl/page/does/not/exist/"
            : "/nl/page/does/not/exist"
        });

        const result = await handler(event);

        expect(result.statusCode).toEqual(404);
        expect(s3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            Command: "GetObjectCommand",
            Key: "/static-pages/build-id/nl/404.html"
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
              Key: "/static-pages/build-id/en/404.html"
            })
          );
        }
      );
    });

    describe("500 page", () => {
      it("returns default 500 page if page render has an error", async () => {
        const event = createRequestEvent({
          uri: trailingSlash ? "/erroredPage/" : "/erroredPage"
        });

        mockPageRequire("pages/erroredPage.js");

        const result = await handler(event);

        expect(result.statusCode).toEqual(500);
        expect(s3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            Command: "GetObjectCommand",
            Key: "/static-pages/build-id/en/500.html"
          })
        );
      });

      it("serves 500 with correct Cache-Control and Content-Type", async () => {
        const event = createRequestEvent({
          uri: trailingSlash ? "/erroredPage/" : "/erroredPage"
        });

        mockPageRequire("pages/erroredPage.js");

        const response = await handler(event);

        expect(response.headers).toEqual({
          "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate",
          "Content-Type": "text/html"
        });
      });
    });

    describe("Custom Redirects", () => {
      if (trailingSlash) {
        it.each`
          uri                                     | expectedRedirect            | expectedRedirectStatusCode
          ${"/terms-new/"}                        | ${"/terms/"}                | ${308}
          ${"/old-blog/abc/"}                     | ${"/news/abc/"}             | ${308}
          ${"/old-users/1234/"}                   | ${"/users/1234/"}           | ${307}
          ${"/external/"}                         | ${"https://example.com"}    | ${308}
          ${"/terms-redirect-dest-query/"}        | ${"/terms/?foo=bar"}        | ${308}
          ${"/terms-redirect-dest-query/?a=b"}    | ${"/terms/?a=b&foo=bar"}    | ${308}
          ${"/en/terms-new/"}                     | ${"/terms/"}                | ${308}
          ${"/en/old-blog/abc/"}                  | ${"/news/abc/"}             | ${308}
          ${"/en/old-users/1234/"}                | ${"/users/1234/"}           | ${307}
          ${"/en/external/"}                      | ${"https://example.com"}    | ${308}
          ${"/en/terms-redirect-dest-query/"}     | ${"/terms/?foo=bar"}        | ${308}
          ${"/en/terms-redirect-dest-query/?a=b"} | ${"/terms/?a=b&foo=bar"}    | ${308}
          ${"/nl/terms-new/"}                     | ${"/nl/terms/"}             | ${308}
          ${"/nl/old-blog/abc/"}                  | ${"/nl/news/abc/"}          | ${308}
          ${"/nl/old-users/1234/"}                | ${"/nl/users/1234/"}        | ${307}
          ${"/nl/external/"}                      | ${"https://example.com"}    | ${308}
          ${"/nl/terms-redirect-dest-query/"}     | ${"/nl/terms/?foo=bar"}     | ${308}
          ${"/nl/terms-redirect-dest-query/?a=b"} | ${"/nl/terms/?a=b&foo=bar"} | ${308}
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
          uri                                    | expectedRedirect           | expectedRedirectStatusCode
          ${"/terms-new"}                        | ${"/terms"}                | ${308}
          ${"/old-blog/abc"}                     | ${"/news/abc"}             | ${308}
          ${"/old-users/1234"}                   | ${"/users/1234"}           | ${307}
          ${"/external"}                         | ${"https://example.com"}   | ${308}
          ${"/terms-redirect-dest-query"}        | ${"/terms?foo=bar"}        | ${308}
          ${"/terms-redirect-dest-query?a=b"}    | ${"/terms?a=b&foo=bar"}    | ${308}
          ${"/en/terms-new"}                     | ${"/terms"}                | ${308}
          ${"/en/old-blog/abc"}                  | ${"/news/abc"}             | ${308}
          ${"/en/old-users/1234"}                | ${"/users/1234"}           | ${307}
          ${"/en/external"}                      | ${"https://example.com"}   | ${308}
          ${"/en/terms-redirect-dest-query"}     | ${"/terms?foo=bar"}        | ${308}
          ${"/en/terms-redirect-dest-query?a=b"} | ${"/terms?a=b&foo=bar"}    | ${308}
          ${"/nl/terms-new"}                     | ${"/nl/terms"}             | ${308}
          ${"/nl/old-blog/abc"}                  | ${"/nl/news/abc"}          | ${308}
          ${"/nl/old-users/1234"}                | ${"/nl/users/1234"}        | ${307}
          ${"/nl/external"}                      | ${"https://example.com"}   | ${308}
          ${"/nl/terms-redirect-dest-query"}     | ${"/nl/terms?foo=bar"}     | ${308}
          ${"/nl/terms-redirect-dest-query?a=b"} | ${"/nl/terms?a=b&foo=bar"} | ${308}
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
        uri                                   | expectedPage
        ${"/index-rewrite"}                   | ${"/en.html"}
        ${"/terms"}                           | ${"/en/terms.html"}
        ${"/terms-rewrite"}                   | ${"/en/terms.html"}
        ${"/path-rewrite/123"}                | ${"/en/terms.html"}
        ${"/terms-rewrite-dest-query?a=b"}    | ${"/en/terms.html"}
        ${"/en/index-rewrite"}                | ${"/en.html"}
        ${"/en/terms"}                        | ${"/en/terms.html"}
        ${"/en/terms-rewrite"}                | ${"/en/terms.html"}
        ${"/en/path-rewrite/123"}             | ${"/en/terms.html"}
        ${"/en/terms-rewrite-dest-query?a=b"} | ${"/en/terms.html"}
        ${"/nl/index-rewrite"}                | ${"/nl.html"}
        ${"/nl/terms"}                        | ${"/nl/terms.html"}
        ${"/nl/terms-rewrite"}                | ${"/nl/terms.html"}
        ${"/nl/path-rewrite/123"}             | ${"/nl/terms.html"}
        ${"/nl/terms-rewrite-dest-query?a=b"} | ${"/nl/terms.html"}
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
        uri                       | rewriteUri                | method
        ${"/external-rewrite"}    | ${"https://external.com"} | ${"GET"}
        ${"/external-rewrite"}    | ${"https://external.com"} | ${"POST"}
        ${"/en/external-rewrite"} | ${"https://external.com"} | ${"GET"}
        ${"/en/external-rewrite"} | ${"https://external.com"} | ${"POST"}
        ${"/nl/external-rewrite"} | ${"https://external.com"} | ${"GET"}
        ${"/nl/external-rewrite"} | ${"https://external.com"} | ${"POST"}
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
        path               | expectedPage             | expectedPath
        ${"/promise-page"} | ${"pages/async-page.js"} | ${"/en/promise-page"}
      `(
        "serves page $expectedPage for rewritten path $path with correct request url",
        async ({ path, expectedPage, expectedPath }) => {
          // If trailingSlash = true, append "/" to get the non-redirected path
          if (trailingSlash && !path.endsWith("/")) {
            path += "/";
            expectedPath += "/";
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
          expect(firstArgument).toMatchObject({ url: expectedPath });
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
