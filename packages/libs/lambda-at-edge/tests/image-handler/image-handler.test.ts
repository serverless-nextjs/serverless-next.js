import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/image-handler";
import { runRedirectTestWithHandler } from "../utils/runRedirectTest";

jest.mock(
  "../../src/manifest.json",
  () => require("./image-build-manifest.json"),
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

describe("Image lambda handler", () => {
  describe("Routes", () => {
    it("returns 404 for non-image routes", async () => {
      const event = createCloudFrontEvent({
        uri: "/_next/not-image",
        host: "mydistribution.cloudfront.net"
      });

      const response = await handler(event);

      expect(response.status).toEqual("404");
    });
  });

  const runRedirectTest = async (
    path: string,
    expectedRedirect: string,
    statusCode: number,
    querystring?: string,
    host?: string
  ): Promise<void> => {
    await runRedirectTestWithHandler(
      handler,
      path,
      expectedRedirect,
      statusCode,
      querystring,
      host
    );
  };

  describe("Domain Redirects", () => {
    it.each`
      path              | querystring | expectedRedirect                                | expectedRedirectStatusCode
      ${"/_next/image"} | ${""}       | ${"https://www.example.com/_next/image"}        | ${308}
      ${"/_next/image"} | ${"a=1234"} | ${"https://www.example.com/_next/image?a=1234"} | ${308}
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
});
