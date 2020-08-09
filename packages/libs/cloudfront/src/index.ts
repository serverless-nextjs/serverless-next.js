import AWS from "aws-sdk";
import CloudFrontClientFactory, { Credentials } from "./lib/cloudfront";

export type CreateInvalidationOptions = {
  credentials: Credentials;
  distributionId: string;
  paths?: string[];
};

const createInvalidation = async (
  options: CreateInvalidationOptions
): Promise<AWS.CloudFront.CreateInvalidationResult> => {
  const { credentials, distributionId, paths } = options;
  const cf = CloudFrontClientFactory({
    credentials
  });

  return cf.createInvalidation({ distributionId, paths });
};

export default createInvalidation;
