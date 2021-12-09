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
  getDistribution: (
    distributionId: string
  ) => Promise<AWS.CloudFront.GetDistributionResult>;
};

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export default ({
  credentials
}: CloudFrontClientFactoryOptions): CloudFrontClient => {
  if (AWS?.config) {
    AWS.config.update({
      maxRetries: parseInt(process.env.SLS_NEXT_MAX_RETRIES ?? "10"),
      retryDelayOptions: { base: 200 }
    });
  }

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
    },
    getDistribution: async (
      distributionId: string
    ): Promise<AWS.CloudFront.GetDistributionResult> => {
      return await cloudFront
        .getDistribution({
          Id: distributionId
        })
        .promise();
    }
  };
};
