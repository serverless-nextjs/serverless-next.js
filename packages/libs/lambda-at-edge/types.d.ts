import {
  CloudFrontEvent,
  CloudFrontRequest,
  CloudFrontResponse
} from "aws-lambda";
import { BasicInvalidationUrlGroup } from "./src/lib/invalidation/invalidationUrlGroup";

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

export type OriginRequestApiHandlerManifest = {
  apis: {
    dynamic: DynamicPageKeyValue;
    nonDynamic: {
      [key: string]: string;
    };
  };
  domainRedirects: {
    [key: string]: string;
  };
  enableHTTPCompression: boolean;
  authentication?: {
    username: string;
    password: string;
  };
};

export type OriginRequestDefaultHandlerManifest = {
  buildId: string;
  distributionId: string;
  logLambdaExecutionTimes: boolean;
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
  trailingSlash: boolean;
  enableHTTPCompression: boolean;
  domainRedirects: {
    [key: string]: string;
  };
  authentication?: {
    username: string;
    password: string;
  };
  canonicalHostname?: string;
  urlRewrites?: UrlRewriteList;
  enableDebugMode?: boolean;
  invalidationUrlGroups?: BasicInvalidationUrlGroup[];
  notFoundPageMark?: string;
  permanentStaticPages?: string[];
};

export type OriginRequestImageHandlerManifest = {
  enableHTTPCompression: boolean;
  domainRedirects: {
    [key: string]: string;
  };
};

export type RevalidationEvent = {
  revalidate?: boolean;
  Records: [
    { cf: { request: CloudFrontRequest; config: CloudFrontEvent["config"] } }
  ];
};

export type OriginRequestEvent = {
  revalidate?: boolean;
  Records: [
    { cf: { request: CloudFrontRequest; config: CloudFrontEvent["config"] } }
  ];
};

export type OriginResponseEvent = {
  revalidate?: boolean;
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

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  rewrites: RewriteData[];
  headers: HeaderData[];
};

export type PerfLogger = {
  now: () => number | undefined;
  log: (metricDescription: string, t1?: number, t2?: number) => void;
};

export type UrlRewriteList = { originUrl: string; rewriteUrl: string }[];
