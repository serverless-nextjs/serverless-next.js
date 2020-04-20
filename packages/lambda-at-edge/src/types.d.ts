import { CloudFrontRequest } from "aws-lambda";

export type DynamicPageKeyValue = {
  [key: string]: {
    file: string;
    regex: string;
  };
};

export type OriginRequestApiHandlerManifest = {
  apis: {
    dynamic: DynamicPageKeyValue;
    nonDynamic: {
      [key: string]: string;
    };
  };
};

export type OriginRequestDefaultHandlerManifest = {
  pages: {
    ssr: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      nonDynamic: {
        [path: string]: string;
      };
      dynamic: DynamicPageKeyValue;
    };
  };
  publicFiles: {
    [key: string]: string;
  };
};

export type OriginRequestEvent = {
  Records: [{ cf: { request: CloudFrontRequest } }];
};
