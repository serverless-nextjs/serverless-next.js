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

    describe("API pages routing", () => {
      it.each`
        path                   | expectedPage
        ${"/api/getCustomers"} | ${"pages/api/getCustomers.js"}
        ${"/api/getUser"}      | ${"pages/api/getUser.js"}
        ${"/api/users/1"}      | ${"pages/api/users/[id].js"}
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
    });

    describe("404 page", () => {
      it("returns 404 page if request path can't be matched to any api routes", async () => {
        const event = createRequestEvent({
          uri: trailingSlash ? "/api/does/not/exist/" : "/api/does/not/exist"
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
    });
    /*
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
*/
    describe("Custom Redirects", () => {
      if (trailingSlash) {
        it.each`
          uri                                    | expectedRedirect            | expectedRedirectStatusCode
          ${"/api/deprecated/getCustomers/"}     | ${"/api/getCustomers/"}     | ${308}
          ${"/api/deprecated/getCustomers/?a=b"} | ${"/api/getCustomers/?a=b"} | ${308}
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
          uri                                   | expectedRedirect           | expectedRedirectStatusCode
          ${"/api/deprecated/getCustomers"}     | ${"/api/getCustomers"}     | ${308}
          ${"/api/deprecated/getCustomers?a=b"} | ${"/api/getCustomers?a=b"} | ${308}
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
        path                   | querystring | expectedRedirect                                     | expectedRedirectStatusCode
        ${"/api/getCustomers"} | ${""}       | ${"https://www.example.com/api/getCustomers"}        | ${308}
        ${"/api/getCustomers"} | ${"a=1234"} | ${"https://www.example.com/api/getCustomers?a=1234"} | ${308}
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
        path                           | expectedPage
        ${"/api/rewrite-getCustomers"} | ${"pages/api/getCustomers.js"}
        ${"/api/user/1"}               | ${"pages/api/getUser.js"}
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
        uri                        | rewriteUri                | method
        ${"/api/external-rewrite"} | ${"https://external.com"} | ${"GET"}
        ${"/api/external-rewrite"} | ${"https://external.com"} | ${"POST"}
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
        path             | expectedPage              | expectedQuery
        ${"/api/user/2"} | ${"pages/api/getUser.js"} | ${"id=2"}
      `(
        "serves page $expectedPage for rewritten path $path with correct request url",
        async ({ path, expectedPage, expectedQuery }) => {
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
          const call = page.default.mock.calls[0];
          const firstArgument = call[0];
          expect(firstArgument).toMatchObject({
            url: `${path}?${expectedQuery}`
          });
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
        path                   | expectedHeaders                    | expectedPage
        ${"/api/getCustomers"} | ${{ "x-custom-header": "custom" }} | ${"pages/api/getCursomers.js"}
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
