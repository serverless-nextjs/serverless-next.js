import type {
  CloudFrontRequest,
  CloudFrontEvent,
  CloudFrontResponse
} from "aws-lambda";
import { ApiManifest, PageManifest } from "@sls-next/core";

export type DynamicPageKeyValue = {
  [key: string]: {
    file: string;
    regex: string;
  };
};

// Image optimization
export type ImageConfig = {
  deviceSizes: number[];
  imageSizes: number[];
  loader: "default" | "imgix" | "cloudinary" | "akamai";
  path: string;
  domains?: string[];
};

export type ImagesManifest = {
  version: number;
  images: ImageConfig;
};

export type OriginRequestApiHandlerManifest = ApiManifest & {
  enableHTTPCompression?: boolean;
};

export type OriginRequestDefaultHandlerManifest = PageManifest & {
  logLambdaExecutionTimes?: boolean;
  enableHTTPCompression?: boolean;
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

export type RedirectData = {
  statusCode: number;
  source: string;
  destination: string;
  regex: string;
  internal?: boolean;
};

export type RewriteData = {
  source: string;
  destination: string;
  regex: string;
};

export type Header = {
  key: string;
  value: string;
};

export type HeaderData = {
  source: string;
  headers: Header[];
  regex: string;
};

export type I18nData = {
  locales: string[];
  defaultLocale: string;
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  rewrites: RewriteData[];
  headers: HeaderData[];
  i18n?: I18nData;
};

export type PerfLogger = {
  now: () => number | undefined;
  log: (metricDescription: string, t1?: number, t2?: number) => void;
};
