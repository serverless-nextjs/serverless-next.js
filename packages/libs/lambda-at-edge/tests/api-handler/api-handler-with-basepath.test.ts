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
  () => require("./api-basepath-routes-manifest.json"),
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

describe("API lambda handler with basePath configured", () => {
  it("serves api request", async () => {
    const event = createCloudFrontEvent({
      uri: "/basepath/api/getCustomers",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.s3.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/api/getCustomers.js");

    const response = (await handler(event)) as CloudFrontResponseResult;

    const decodedBody = Buffer.from(response.body, "base64").toString("utf8");

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
      path                                       | expectedRedirect                | expectedRedirectStatusCode
      ${"/basepath/api/deprecated/getCustomers"} | ${"/basepath/api/getCustomers"} | ${308}
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

  describe("Custom Rewrites", () => {
    it.each`
      path                                    | expectedJs                     | expectedBody                | expectedStatus
      ${"/basepath/api/rewrite-getCustomers"} | ${"pages/api/getCustomers.js"} | ${"pages/api/getCustomers"} | ${200}
      ${"/basepath/api/getCustomers"}         | ${"pages/api/getCustomers.js"} | ${"pages/api/getCustomers"} | ${200}
    `(
      "serves API $expectedJs for rewritten path $path",
      async ({ path, expectedJs, expectedBody, expectedStatus }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net",
          origin: {
            s3: {
              domainName: "my-bucket.s3.amazonaws.com"
            }
          }
        });

        mockPageRequire(expectedJs);

        const response = (await handler(event)) as CloudFrontResponseResult;

        const decodedBody = Buffer.from(response.body, "base64").toString(
          "utf8"
        );

        expect(decodedBody).toEqual(expectedBody);
        expect(response.status).toEqual(expectedStatus);
      }
    );
  });

  describe("Custom Headers", () => {
    it.each`
      path                            | expectedHeaders                    | expectedJs
      ${"/basepath/api/getCustomers"} | ${{ "x-custom-header": "custom" }} | ${"pages/customers/[customer].js"}
    `(
      "has custom headers $expectedHeaders and expectedPage $expectedPage for path $path",
      async ({ path, expectedHeaders, expectedJs }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net"
        });

        mockPageRequire(expectedJs);

        const response = await handler(event);

        expect(response.headers).not.toBeUndefined();

        for (const header in expectedHeaders) {
          const headerEntry = response.headers![header][0];
          expect(headerEntry).toEqual({
            key: header,
            value: expectedHeaders[header]
          });
        }
      }
    );
  });
});
