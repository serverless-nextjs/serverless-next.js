import type {
  CloudFrontRequest,
  CloudFrontEvent,
  CloudFrontResponse
} from "aws-lambda";
import { ApiManifest, PageManifest } from "@sls-next/core";
export { ImageConfig, ImagesManifest, RoutesManifest } from "@sls-next/core";

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
  cloudFrontEventRequest: AWSLambda.CloudFrontRequest;
}

export type PreRenderedManifest = {
  version: 2;
  routes: {
    [route: string]: {
      initialRevalidateSeconds: number | false;
      srcRoute: string | null;
      dataRoute: string;
    };
  };
  dynamicRoutes: {
    [route: string]: {
      routeRegex: string;
      fallback: string | false;
      dataRoute: string;
      dataRouteRegex: string;
    };
  };
  preview: {
    previewModeId: string;
    previewModeSigningKey: string;
    previewModeEncryptionKey: string;
  };
};

export type PerfLogger = {
  now: () => number | undefined;
  log: (metricDescription: string, t1?: number, t2?: number) => void;
};
