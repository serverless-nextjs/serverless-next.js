const { createCloudFrontEvent } = require("../lib/test-utils");
const { handler } = require("../api-lambda-handler");

jest.mock(
  "../manifest.json",
  () => require("./fixtures/api-build-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../next-aws-cloudfront",
  () => {
    return require("next-aws-cloudfront");
  },
  {
    virtual: true
  }
);

const mockPageRequire = mockPagePath => {
  jest.mock(
    `../${mockPagePath}`,
    () => require(`./fixtures/built-artifact/${mockPagePath}`),
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
          domainName: "my-bucket.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/api/getCustomers.js");

    const response = await handler(event, {});

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/api/getCustomers");
    expect(response.status).toEqual(200);
  });
});
