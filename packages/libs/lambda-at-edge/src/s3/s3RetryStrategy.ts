// Need retries to fix https://github.com/aws/aws-sdk-js-v3/issues/1196
import { SdkError } from "@aws-sdk/smithy-client";

export const buildS3RetryStrategy = async () => {
  const { defaultRetryDecider, StandardRetryStrategy } = await import(
    "@aws-sdk/middleware-retry"
  );

  const retryDecider = (err: SdkError & { code?: string }) => {
    if (
      "code" in err &&
      (err.code === "ECONNRESET" ||
        err.code === "EPIPE" ||
        err.code === "ETIMEDOUT")
    ) {
      return true;
    } else {
      return defaultRetryDecider(err);
    }
  };

  return new StandardRetryStrategy(async () => 3, {
    retryDecider
  });
};
