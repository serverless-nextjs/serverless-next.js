import { PublicDirectoryCache } from "@getjerry/s3-static-assets/src/lib/getPublicAssetCacheControl";
import { BasicInvalidationUrlGroup } from "@getjerry/lambda-at-edge/dist/lib/invalidation/invalidationUrlGroup";

export interface LambdaNames<T> {
  defaultLambda?: T;
  apiLambda?: T;
  imageLambda?: T;
}
export interface LambdaOptions {
  memory?: number | LambdaNames<number>;
  timeout?: number | LambdaNames<number>;
  name?: string | LambdaNames<string>;
  runtime?: string | LambdaNames<string>;
}

export type ServerlessComponentInputs = {
  stage?: string;
  canonicalHostname?: string;
  build?: BuildOptions | boolean;
  nextConfigDir?: string;
  useServerlessTraceTarget?: boolean;
  logLambdaExecutionTimes?: boolean;
  nextStaticDir?: string;
  bucketName?: string;
  bucketRegion?: string;
  publicDirectoryCache?: PublicDirectoryCache;
  lambda?: LambdaOptions;
  name?: string | LambdaNames<string>;
  memory?: number | LambdaNames<number>;
  timeout?: number | LambdaNames<number>;
  runtime?: string | LambdaNames<string>;
  handler?: string;
  description?: string;
  policy?: string;
  roleArn?: string;
  domain?: string | string[];
  domainType?: "www" | "apex" | "both";
  domainRedirects?: { [key: string]: string };
  staticCachePolicyId?: string;
  staticOriginRequestPolicyId?: string;
  dynamicCachePolicyId?: string;
  dynamicOriginRequestPolicyId?: string;
  nextImageLoader?: {
    cachePolicyId?: string;
    originRequestPolicyId?: string;
  };

  cloudfront?: CloudfrontOptions;
  minifyHandlers?: boolean;
  uploadStaticAssetsFromBuild?: boolean;
  deploy?: boolean;
  enableHTTPCompression?: boolean;
  authentication?: { username: string; password: string };
  imageOptimizer?: boolean;
  certificateArn?: string;
  urlRewrites?: UrlRewriteOptions;
  enableDebugMode?: boolean;
  invalidationUrlGroups?: BasicInvalidationUrlGroup[];
  // If page contains this mark, will set 404 status code
  notFoundPageMark?: string;
  // For some very important pages that need to be always available, such as the home page.
  permanentStaticPages?: string[];
  enableSentryTrack?: boolean;
};

type CloudfrontOptions = Record<string, any>;

export type BuildOptions = {
  cwd?: string;
  enabled?: boolean;
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  postBuildCommands?: string[];
};

export type LambdaType = "defaultLambda" | "apiLambda" | "imageLambda";

export enum Lambdas {
  default = "default",
  api = "api",
  image = "image"
}

export type LambdaInput = {
  description: string;
  handler: string;
  code: string;
  role: Record<string, unknown>;
  memory: number;
  timeout: number;
  runtime: string;
  name?: string;
};

type UrlRewriteOptions = {
  originUrl: string;
  rewriteUrl: string;
  originUrlParams: string | string[];
}[];
