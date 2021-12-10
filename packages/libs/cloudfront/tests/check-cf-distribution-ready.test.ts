import AWS, { mockGetDistribution } from "aws-sdk";
import {
  checkCloudFrontDistributionReady,
  CheckCloudFrontDistributionReadyOptions
} from "../src/index";

jest.mock("aws-sdk", () => require("./aws-sdk.mock"));

const checkReady = (
  options: Partial<CheckCloudFrontDistributionReadyOptions> = {}
): Promise<boolean> => {
  return checkCloudFrontDistributionReady({
    ...options,
    distributionId: "fake-distribution-id",
    credentials: {
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    },
    waitDuration: 1,
    pollInterval: 1
  });
};

describe("Check CloudFront distribution ready tests", () => {
  it("passes credentials to CloudFront client", async () => {
    mockGetDistribution.mockReturnValue({
      promise: () => {
        return {
          Distribution: {
            Status: "Deployed"
          }
        };
      }
    });

    await checkReady();

    expect(AWS.CloudFront).toBeCalledWith({
      credentials: {
        accessKeyId: "fake-access-key",
        secretAccessKey: "fake-secret-key",
        sessionToken: "fake-session-token"
      }
    });
  });

  it("successfully waits for CloudFront distribution", async () => {
    const isReady = await checkReady();

    expect(isReady).toBe(true);
    expect(mockGetDistribution).toBeCalledWith({ Id: "fake-distribution-id" });
  });

  it("times out waiting for CloudFront distribution", async () => {
    mockGetDistribution.mockReturnValue({
      promise: () => {
        return {
          Distribution: {
            Status: "InProgress"
          }
        };
      }
    });

    const isReady = await checkReady();

    expect(isReady).toBe(false);
    expect(mockGetDistribution).toBeCalledWith({ Id: "fake-distribution-id" });
  });
});
