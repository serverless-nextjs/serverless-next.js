export const BUILD_DIR = ".serverless_nextjs";
export const DEFAULT_LAMBDA_CODE_DIR = ".serverless_nextjs/default-lambda";
export const API_LAMBDA_CODE_DIR = ".serverless_nextjs/api-lambda";
export const IMAGE_LAMBDA_CODE_DIR = ".serverless_nextjs/image-lambda";

// Now we met conflicts when deploy.
// This is because cloudfront distribution update has very strict version check.
// Errors caused by this can be fix be retry.
export const RETRYABLE_UPDATE_CLOUDFRONT_DISTRIBUTION_ERRORS = [
  "PreconditionFailed", // normally because ETag changed, means distribution already updated to newer version.
  "OperationAborted" // specific that distribution is in updating status, wait and retry later.
];
