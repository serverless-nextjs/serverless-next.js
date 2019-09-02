const { handler } = require("../lambda-at-edge-handler");
const { createCloudFrontEvent } = require("../lib/test-utils");

jest.mock(
  "../manifest.json",
  () => {
    const manifest = require("./fixtures/manifest.json");
    manifest["ssr@edge"] = true;
    return manifest;
  },
  {
    virtual: true
  }
);

const mockPageRequire = mockPagePath => {
  jest.mock(
    mockPagePath,
    () => require(`./fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("When SSR@Edge is enabled", () => {
  it("renders page at the edge", async () => {
    const event = createCloudFrontEvent({
      uri: "/customers",
      host: "mydistribution.cloudfront.net",
      origin: {
        ssr: {
          domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
        }
      }
    });

    mockPageRequire("./pages/customers/index.js");

    const response = await handler(event, {});

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/customers/index.js");
    expect(response.status).toEqual(200);
  });
});
