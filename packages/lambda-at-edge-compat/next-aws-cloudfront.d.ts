import { CloudFrontResultResponse, CloudFrontRequest } from "aws-lambda";
import { IncomingMessage, ServerResponse } from "http";

declare function lambdaAtEdgeCompat(event: {
  request: CloudFrontRequest;
}): {
  responsePromise: Promise<CloudFrontResultResponse>;
  req: IncomingMessage;
  res: ServerResponse;
};

export = lambdaAtEdgeCompat;
