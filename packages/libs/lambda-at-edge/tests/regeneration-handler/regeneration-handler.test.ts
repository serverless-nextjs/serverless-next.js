import { createCloudFrontEvent } from "../test-utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock("node-fetch", () => require("fetch-mock-jest").sandbox());

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

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

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    () => require(`../shared-fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("Regeneration Handler", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "error").mockReturnValue();

    jest.mock(
      "../../src/manifest.json",
      () => require("./default-build-manifest.json"),
      {
        virtual: true
      }
    );

    jest.mock(`../../src/s3/s3StorePage`);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it.each`
    basePath
    ${"/custom"}
    ${undefined}
  `(
    "should generate correct page when basePath = $basePath",
    async ({ basePath }) => {
      mockPageRequire("pages/customers/index");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const regenerationHandler = require("../../src/regeneration-handler")
        .handler;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const s3StorePage = require("../../src/s3/s3StorePage").s3StorePage;

      const event = createCloudFrontEvent({
        uri: "/customers/index.html",
        host: "mydistribution.cloudfront.net",
        config: {
          eventType: "origin-request"
        } as AWSLambda.CloudFrontEvent["config"],
        querystring: undefined,
        requestHeaders: {}
      });

      await regenerationHandler({
        basePath,
        bucketName: "my-bucket",
        cloudFrontEventRequest: event.Records[0].cf.request,
        region: "us-east-1"
      });

      expect(s3StorePage).toBeCalledTimes(1);
      expect(s3StorePage).toBeCalledWith(
        expect.objectContaining({
          basePath,
          uri: "/customers/index",
          pageData: { page: "pages/customers/index.js" }
        })
      );
    }
  );

  it("should generate correct page when path exists in nonDynamic routes", async () => {
    mockPageRequire("pages/preview");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const regenerationHandler = require("../../src/regeneration-handler")
      .handler;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const s3StorePage = require("../../src/s3/s3StorePage").s3StorePage;

    const event = createCloudFrontEvent({
      uri: "/preview.html",
      host: "mydistribution.cloudfront.net",
      config: {
        eventType: "origin-request"
      } as AWSLambda.CloudFrontEvent["config"],
      querystring: undefined,
      requestHeaders: {}
    });

    await regenerationHandler({
      basePath: undefined,
      bucketName: "my-bucket",
      cloudFrontEventRequest: event.Records[0].cf.request,
      region: "us-east-1"
    });

    expect(s3StorePage).toBeCalledTimes(1);
    expect(s3StorePage).toBeCalledWith(
      expect.objectContaining({
        basePath: undefined,
        uri: "/preview",
        pageData: { page: "pages/preview.js" }
      })
    );
  });
});
