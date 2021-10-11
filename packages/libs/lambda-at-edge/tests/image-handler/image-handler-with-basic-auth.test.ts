import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/image-handler";
import { ImagesManifest, PlatformClient } from "@sls-next/core/dist";
import { IncomingMessage, ServerResponse } from "http";
import { UrlWithParsedQuery } from "url";

jest.mock(
  "../../src/manifest.json",
  () => require("./image-build-manifest-with-basic-auth.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/images-manifest.json",
  () => require("./image-images-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./image-routes-manifest.json"),
  {
    virtual: true
  }
);

jest.mock("@sls-next/core/dist/module", () => {
  return {
    imageOptimizer: jest.fn(
      (
        basePath: string,
        imagesManifest: ImagesManifest | undefined,
        req: IncomingMessage,
        res: ServerResponse,
        parsedUrl: UrlWithParsedQuery,
        platformClient: PlatformClient
      ) => {
        // Simulate successful response
        res.statusCode = 200;
        res.end("success");
      }
    ),
    handleAuth: jest.requireActual("@sls-next/core/dist/module").handleAuth,
    handleDomainRedirects: jest.requireActual("@sls-next/core/dist/module")
      .handleDomainRedirects,
    setCustomHeaders: jest.requireActual("@sls-next/core/dist/module")
      .setCustomHeaders
  };
});

describe("Image lambda handler", () => {
  describe("Basic Authentication", () => {
    it.each`
      usernamePassword | expectedAuthenticateSuccess
      ${"test:123"}    | ${true}
      ${"test:wrong"}  | ${false}
    `(
      "for $usernamePassword, authenticated successfully: $expectedAuthenticateSuccess",
      async ({ usernamePassword, expectedAuthenticateSuccess }) => {
        const event = createCloudFrontEvent({
          uri: "/_next/image?url=%2Ftest.png&q=100&w=128",
          host: "mydistribution.cloudfront.net",
          requestHeaders: {
            authorization: [
              {
                key: "Authorization",
                value:
                  "Basic " + Buffer.from(usernamePassword).toString("base64")
              }
            ]
          }
        });

        const response = await handler(event);

        if (expectedAuthenticateSuccess) {
          expect(response.status).not.toEqual("401"); // We are only testing whether unauthorized or not.
        } else {
          expect(response).toEqual({
            status: "401",
            statusDescription: "Unauthorized",
            body: "Unauthorized",
            headers: {
              "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
            },
            isUnauthorized: true
          });
        }
      }
    );
  });
});
