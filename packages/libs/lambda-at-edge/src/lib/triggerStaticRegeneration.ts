import { s3BucketNameFromEventRequest } from "../s3/s3BucketNameFromEventRequest";
import { RegenerationEvent } from "../types";
import * as crypto from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

interface TriggerStaticRegenerationOptions {
  request: AWSLambda.CloudFrontRequest;
  eTag: string | undefined;
  lastModified: string | undefined;
  basePath: string | undefined;
  pagePath: string;
  pageS3Path: string;
  queueName: string;
}

export const triggerStaticRegeneration = async (
  options: TriggerStaticRegenerationOptions
): Promise<{ throttle: boolean }> => {
  const { region } = options.request.origin?.s3 || {};
  const bucketName = s3BucketNameFromEventRequest(options.request);
  const queueName = options.queueName;

  if (!bucketName) {
    throw new Error("Expected bucket name to be defined");
  }

  if (!region) {
    throw new Error("Expected region to be defined");
  }

  const sqs = new SQSClient({
    region,
    maxAttempts: 1
  });

  const regenerationEvent: RegenerationEvent = {
    region,
    bucketName,
    pageS3Path: options.pageS3Path,
    cloudFrontEventRequest: options.request,
    basePath: options.basePath,
    pagePath: options.pagePath
  };

  try {
    // Hash URI for messageGroupId to allow for long URIs, as SQS has limit of 128 characters
    // MD5 is used since this is only used for grouping purposes
    const hashedUri = crypto
      .createHash("md5")
      .update(options.request.uri)
      .digest("hex");

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: `https://sqs.${region}.amazonaws.com/${queueName}`,
        MessageBody: JSON.stringify(regenerationEvent), // This is not used, however it is a required property
        // We only want to trigger the regeneration once for every previous
        // update. This will prevent the case where this page is being
        // requested again whilst its already started to regenerate.
        MessageDeduplicationId:
          options.eTag ??
          (options.lastModified
            ? new Date(options.lastModified).getTime().toString()
            : new Date().getTime().toString()),
        // Only deduplicate based on the object, i.e. we can generate
        // different pages in parallel, just not the same one
        MessageGroupId: hashedUri
      })
    );
    return { throttle: false };
  } catch (error: any) {
    if (error.code === "RequestThrottled") {
      return { throttle: true };
    } else {
      throw error;
    }
  }
};
