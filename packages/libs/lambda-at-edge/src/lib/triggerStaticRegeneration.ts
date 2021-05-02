import { s3BucketNameFromEventRequest } from "../s3/s3BucketNameFromEventRequest";
import { buildS3RetryStrategy } from "../s3/s3RetryStrategy";
import { RegenerationEvent } from "../types";

interface TriggerStaticRegenerationOptions {
  request: AWSLambda.CloudFrontRequest;
  response: AWSLambda.CloudFrontResponse;
  basePath: string | undefined;
}

export const triggerStaticRegeneration = async (
  options: TriggerStaticRegenerationOptions
): Promise<void> => {
  const { region } = options.request.origin?.s3 || {};
  const bucketName = s3BucketNameFromEventRequest(options.request);

  if (!bucketName) {
    throw new Error("Expected bucket name to be defined");
  }

  if (!region) {
    throw new Error("Expected region to be defined");
  }

  const { LambdaClient, InvokeAsyncCommand } = await import(
    "@aws-sdk/client-lambda"
  );
  const lambda = new LambdaClient({
    region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });

  const regenerationEvent: RegenerationEvent = {
    region,
    bucketName,
    cloudFrontEventRequest: options.request,
    basePath: options.basePath
  };

  await lambda.send(
    new InvokeAsyncCommand({
      FunctionName: bucketName,
      InvokeArgs: JSON.stringify(regenerationEvent)
    })
  );
};
