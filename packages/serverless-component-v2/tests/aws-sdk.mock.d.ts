import AWS from "aws-sdk";

declare module "aws-sdk" {
  const mockCreateCloudFrontDistribution: jest.Mock;
  const mockCreateCloudFrontDistributionPromise: jest.Mock;
}
