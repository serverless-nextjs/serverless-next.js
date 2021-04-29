import { s3BucketNameFromEventRequest } from "../s3/s3BucketNameFromEventRequest";
import { buildS3RetryStrategy } from "../s3/s3RetryStrategy";
import { OriginRequestDefaultHandlerManifest } from "../types";

interface TriggerStaticRegenerationOptions {
  request: AWSLambda.CloudFrontRequest;
  response: AWSLambda.CloudFrontResponse;
  manifest: OriginRequestDefaultHandlerManifest;
  basePath: string | undefined;
}

export const triggerStaticRegeneration = async (
  options: TriggerStaticRegenerationOptions
): Promise<void> => {
  const { region } = options.request.origin?.s3 || {};
  const bucketName = s3BucketNameFromEventRequest(options.request);

  const { SQSClient, SendMessageCommand } = await import("@aws-sdk/client-sqs");
  const sqs = new SQSClient({
    region,
    maxAttempts: 3,
    retryStrategy: await buildS3RetryStrategy()
  });

  const lastModifiedAt = new Date(
    options.response.headers["last-modified"]?.[0].value
  )
    .getTime()
    .toString();

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: `https://sqs.${region}.amazonaws.com/${bucketName}.fifo`,
      MessageBody: options.request.uri, // This is not used, however it is a required property
      MessageAttributes: {
        BucketRegion: {
          DataType: "String",
          StringValue: region
        },
        BucketName: {
          DataType: "String",
          StringValue: bucketName
        },
        CloudFrontEventRequest: {
          DataType: "String",
          StringValue: JSON.stringify(options.request)
        },
        Manifest: {
          DataType: "String",
          StringValue: JSON.stringify(options.manifest)
        },
        ...(options.basePath
          ? {
              BasePath: {
                DataType: "String",
                StringValue: options.basePath
              }
            }
          : {})
      },
      // We only want to trigger the regeneration once for every previous
      // update. This will prevent the case where this page is being
      // requested again whilst its already started to regenerate.
      MessageDeduplicationId: lastModifiedAt,
      // Only deduplicate based on the object, i.e. we can generate
      // different pages in parallel, just not the same one
      MessageGroupId: options.request.uri
    })
  );
};
