import NextjsComponent from "../../src/serverless";
import {
  MockedCloudFront,
  MockedLambda,
  mockCreateCloudFrontDistribution,
  mockCreateCloudFrontDistributionPromise,
  mockCreateFunction
} from "aws-sdk";
import { assertHasDefaultCacheBehaviour } from "../cloudFront-test-utils";

jest.mock("aws-sdk", () => {
  return require("../aws-sdk.mock");
});

describe("Single SSR Page", () => {
  beforeEach(async () => {
    const component = new NextjsComponent();
    await component.deploy({});
  });

  it("creates lambda function", () => {
    expect(MockedLambda).toBeCalledWith({
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-access-key"
      }
    });
    expect(mockCreateFunction).toBeCalledTimes(1);
  });

  describe("CloudFront default cache behaviour", () => {
    it("creates default cache behaviour", async () => {
      expect(MockedCloudFront).toBeCalledWith({
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-access-key"
        }
      });
      assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {});
      expect(mockCreateCloudFrontDistributionPromise).toBeCalledTimes(1);
    });

    it("has TTL set to 0", async () => {
      assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {
        MinTTL: 0,
        DefaultTTL: 0,
        MaxTTL: 0
      });
    });

    it("forwards all cookies and query string", async () => {
      assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {
        ForwardedValues: {
          Cookies: {
            Forward: "all"
          },
          QueryString: true
        }
      });
    });

    it("allows HEAD and GET HTTP Methods", async () => {
      assertHasDefaultCacheBehaviour(mockCreateCloudFrontDistribution, {
        AllowedMethods: {
          Quantity: 2,
          Items: ["HEAD", "GET"]
        }
      });
    });
  });
});
