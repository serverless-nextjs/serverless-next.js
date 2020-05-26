import NextjsComponent from "../../src/serverless";
import {
  MockedCloudFront,
  mockCreateCloudFrontDistribution,
  mockCreateCloudFrontDistributionPromise
} from "aws-sdk";
import { assertHasDefaultCacheBehaviour } from "../cloudFront-test-utils";

jest.mock("aws-sdk", () => {
  return require("../aws-sdk.mock");
});

describe("Single SSR Page", () => {
  it("creates CloudFront distribution with default cache behaviour", async () => {
    const component = new NextjsComponent();

    const inputs = {};
    await component.deploy(inputs);

    expect(MockedCloudFront).toBeCalledWith({
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-access-key"
      }
    });
    assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {});
    expect(mockCreateCloudFrontDistributionPromise).toBeCalledTimes(1);
  });

  it("default CacheBehaviour has TTL set to 0", async () => {
    const component = new NextjsComponent();

    const inputs = {};
    await component.deploy(inputs);
    assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {
      MinTTL: 0,
      TTL: 0,
      MaxTTL: 0
    });
  });
});
