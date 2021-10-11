import type {
  CloudFrontRequest,
  CloudFrontEvent,
  CloudFrontResponse
} from "aws-lambda";
import { ApiManifest, PageManifest } from "@sls-next/core/dist/module/types";
export {
  ImageConfig,
  ImagesManifest
} from "@sls-next/core/dist/module/build/types";
export { RoutesManifest } from "@sls-next/core/dist/module/types";

export type OriginRequestApiHandlerManifest = ApiManifest & {
  enableHTTPCompression?: boolean;
};

export type OriginRequestDefaultHandlerManifest = PageManifest & {
  logLambdaExecutionTimes?: boolean;
  enableHTTPCompression?: boolean;
  regenerationQueueName?: string;
  disableOriginResponseHandler?: boolean;
};

export type OriginRequestImageHandlerManifest = {
  enableHTTPCompression?: boolean;
  domainRedirects?: {
    [key: string]: string;
  };
};

export type OriginRequestEvent = {
  Records: [
    { cf: { request: CloudFrontRequest; config: CloudFrontEvent["config"] } }
  ];
};

export type OriginResponseEvent = {
  Records: [
    {
      cf: {
        request: CloudFrontRequest;
        response: CloudFrontResponse;
        config: CloudFrontEvent["config"];
      };
    }
  ];
};

export interface RegenerationEvent {
  pagePath: string;
  basePath: string | undefined;
  region: string;
  bucketName: string;
  pageS3Path: string;
  cloudFrontEventRequest: AWSLambda.CloudFrontRequest;
}
