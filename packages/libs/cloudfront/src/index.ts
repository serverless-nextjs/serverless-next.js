import AWS from "aws-sdk";
import CloudFrontClientFactory, { Credentials } from "./lib/cloudfront";

export type CreateInvalidationOptions = {
  credentials: Credentials;
  distributionId: string;
  paths?: string[];
};

const createInvalidation = (
  options: CreateInvalidationOptions
): Promise<AWS.CloudFront.CreateInvalidationResult> => {
  const { credentials, distributionId, paths } = options;
  const cf = CloudFrontClientFactory({
    credentials
  });

  return cf.createInvalidation({ distributionId, paths });
};

export type CheckCloudFrontDistributionReadyOptions = {
  credentials: Credentials;
  distributionId: string;
  waitDuration: number;
  pollInterval: number;
};

const checkCloudFrontDistributionReady = async (
  options: CheckCloudFrontDistributionReadyOptions
): Promise<boolean> => {
  const { credentials, distributionId, waitDuration, pollInterval } = options;
  const startDate = new Date();
  const startTime = startDate.getTime();
  const waitDurationMillis = waitDuration * 1000;

  const cf = CloudFrontClientFactory({
    credentials
  });

  while (new Date().getTime() - startTime < waitDurationMillis) {
    const result = await cf.getDistribution(distributionId);

    if (result.Distribution?.Status === "Deployed") {
      return true;
    }

    await new Promise((r) => setTimeout(r, pollInterval * 1000));
  }

  return false;
};

export { createInvalidation, checkCloudFrontDistributionReady };
