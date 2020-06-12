import AWS from "aws-sdk";
import { ALL_FILES_PATH } from "./constants";

type CloudFrontClientFactoryOptions = {
  credentials: Credentials;
};

type CreateInvalidationOptions = {
  distributionId: string;
  callerReference?: string;
  paths?: string[];
};

export type CloudFrontClient = {
  createInvalidation: (
    options: CreateInvalidationOptions
  ) => Promise<AWS.CloudFront.CreateInvalidationResult>;
};

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export default ({
  credentials
}: CloudFrontClientFactoryOptions): CloudFrontClient => {
  const cloudFront = new AWS.CloudFront({ credentials });

  return {
    createInvalidation: async (
      options: CreateInvalidationOptions
    ): Promise<AWS.CloudFront.CreateInvalidationResult> => {
      const timestamp = +new Date() + "";
      const {
        distributionId,
        callerReference = timestamp,
        paths = [ALL_FILES_PATH]
      } = options;

      return await cloudFront
        .createInvalidation({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: callerReference,
            Paths: {
              Quantity: paths.length,
              Items: paths
            }
          }
        })
        .promise();
    }
  };
};
