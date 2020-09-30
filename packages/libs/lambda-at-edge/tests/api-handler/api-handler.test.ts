import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/api-handler";
import { CloudFrontResponseResult } from "next-aws-cloudfront/node_modules/@types/aws-lambda";
import { runRedirectTestWithHandler } from "../utils/runRedirectTest";

jest.mock(
  "../../src/manifest.json",
  () => require("./api-build-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./api-routes-manifest.json"),
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

describe("API lambda handler", () => {
  it("serves api request", async () => {
    const event = createCloudFrontEvent({
      uri: "/api/getCustomers",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.s3.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/api/getCustomers.js");

    const response = (await handler(event)) as CloudFrontResponseResult;

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/api/getCustomers");
    expect(response.status).toEqual(200);
  });

  it("returns 404 for not-found api routes", async () => {
    const event = createCloudFrontEvent({
      uri: "/foo/bar",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.s3.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/api/getCustomers.js");

    const response = (await handler(event)) as CloudFrontResponseResult;

    expect(response.status).toEqual("404");
  });

  describe("Custom Redirects", () => {
    let runRedirectTest = async (
      path: string,
      expectedRedirect: string,
      statusCode: number,
      querystring?: string
    ): Promise<void> => {
      await runRedirectTestWithHandler(
        handler,
        path,
        expectedRedirect,
        statusCode,
        querystring
      );
    };

    it.each`
      path                              | expectedRedirect       | expectedRedirectStatusCode
      ${"/api/deprecated/getCustomers"} | ${"/api/getCustomers"} | ${308}
    `(
      "redirects path $path to $expectedRedirect, expectedRedirectStatusCode: $expectedRedirectStatusCode",
      async ({ path, expectedRedirect, expectedRedirectStatusCode }) => {
        await runRedirectTest(
          path,
          expectedRedirect,
          expectedRedirectStatusCode
        );
      }
    );
  });
});
