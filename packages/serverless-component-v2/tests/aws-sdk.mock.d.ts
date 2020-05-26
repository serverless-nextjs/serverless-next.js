import * as AWS from "aws-sdk";

declare module "aws-sdk" {
  export const mockCreateCloudFrontDistribution: jest.Mock;
  export const mockCreateCloudFrontDistributionPromise: jest.Mock;
}
