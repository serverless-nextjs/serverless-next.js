import { CloudFrontResultResponse, CloudFrontRequest } from "aws-lambda";
import { IncomingMessage, ServerResponse } from "http";

type CompatOptions = {
  enableHTTPCompression: boolean;
};

declare function lambdaAtEdgeCompat(
  event: {
    request: CloudFrontRequest;
  },
  options: CompatOptions
): {
  responsePromise: Promise<CloudFrontResultResponse>;
  req: IncomingMessage;
  res: ServerResponse;
};

export default lambdaAtEdgeCompat;
