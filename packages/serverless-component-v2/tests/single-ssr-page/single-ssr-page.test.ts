import NextjsComponent from "../../src/serverless.js";
import AWS, { mockCreateCloudFrontDistributionPromise } from "aws-sdk";

jest.mock("aws-sdk", () => {
  return require("../aws-sdk.mock");
});

describe("Single SSR Page", () => {
  it("creates CloudFront distribution with default cache behaviour", () => {
    console.log(AWS);
    console.log(mockCreateCloudFrontDistributionPromise);
    expect(mockCreateCloudFrontDistributionPromise).toBeCalledWith({
      DistributionConfig: {}
    });
  });
});
