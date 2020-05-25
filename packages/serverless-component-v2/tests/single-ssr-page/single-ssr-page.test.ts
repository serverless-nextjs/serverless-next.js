import NextjsComponent from "../../src/serverless";
import { mockCreateCloudFrontDistributionPromise } from "aws-sdk";
import { assertHasDefaultCacheBehaviour } from "../cloudFront-test-utils";

jest.mock("aws-sdk", () => {
  return require("../aws-sdk.mock");
});

describe("Single SSR Page", () => {
  it("creates CloudFront distribution with default cache behaviour", async () => {
    const component = new NextjsComponent();

    const inputs = {};
    await component.deploy(inputs);

    assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistributionPromise, {});
  });
});
