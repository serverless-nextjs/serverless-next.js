import { ServerlessComponentInputs } from "../../types";

//       imageLambda: ${env.IMAGE_LAMBDA_NAME}
export const populateNames = (
  input: ServerlessComponentInputs
): ServerlessComponentInputs => {
  if (!input.name || typeof input.name !== "string") {
    return input;
  }

  const stage = input.stage || process.env.SERVERLESS_STAGE || "dev";

  return {
    ...input,
    bucketName: input.bucketName || `${input.name}-${stage}`,
    name: {
      apiLambda: `${input.name}-api-${stage}`,
      imageLambda: `${input.name}-image-${stage}`,
      defaultLambda: `${input.name}-default-${stage}`
    }
  };
};
