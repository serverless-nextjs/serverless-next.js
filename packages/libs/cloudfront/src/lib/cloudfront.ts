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
  const cloudFront = new AWS.CloudFront({
    credentials,
    maxRetries: parseInt(process.env.SLS_NEXT_MAX_RETRIES ?? "100"),
    retryDelayOptions: {
      base: 200,
      customBackoff: (retryCount: number, err?: Error) => {
        const delay = 1000 + Math.floor(1000 * Math.random());
        console.warn(
          `Cloudfront retry...
          Retry attempt: ${retryCount}.
          Reason: ${err?.message}.
          Delay: ${delay}ms.`
        );
        return delay;
      }
    }
  });

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
