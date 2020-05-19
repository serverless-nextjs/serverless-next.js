import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/api-handler";
import { CloudFrontResponseResult } from "next-aws-cloudfront/node_modules/@types/aws-lambda";

jest.mock(
  "../../src/manifest.json",
  () => require("./api-build-manifest.json"),
  {
    virtual: true
  }
);

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    () => require(`../fixtures/built-artifact/${mockPagePath}`),
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

    const response = (await handler(event)) as CloudFrontResponseResult;

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/api/getCustomers");
    expect(response.status).toEqual(200);
  });
});
