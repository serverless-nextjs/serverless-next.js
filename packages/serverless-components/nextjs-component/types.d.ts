import { PublicDirectoryCache } from "@sls-next/s3-static-assets/src/lib/getPublicAssetCacheControl";

export type ServerlessComponentInputs = {
  build?: BuildOptions | boolean;
  nextConfigDir?: string;
  useServerlessTraceTarget?: boolean;
  logLambdaExecutionTimes?: boolean;
  nextStaticDir?: string;
  bucketName?: string;
  bucketRegion?: string;
  bucketTags?: Record<string, string>;
  publicDirectoryCache?: PublicDirectoryCache;
  memory?:
    | number
    | {
        defaultLambda?: number;
        apiLambda?: number;
        imageLambda?: number;
        regenerationLambda?: string;
      };
  timeout?:
    | number
    | {
        defaultLambda?: number;
        apiLambda?: number;
        imageLambda?: number;
        regenerationLambda?: string;
      };
  name?:
    | string
    | {
        defaultLambda?: string;
        apiLambda?: string;
        imageLambda?: string;
        regenerationLambda?: string;
      };
  runtime?:
    | string
    | {
        defaultLambda?: string;
        apiLambda?: string;
        imageLambda?: string;
        regenerationLambda?: string;
      };
  roleArn?:
    | string
    | {
        defaultLambda?: string;
        apiLambda?: string;
        imageLambda?: string;
        regenerationLambda?: string;
      };
  tags?:
    | string
    | {
        defaultLambda?: Record<string, string>;
        apiLambda?: Record<string, string>;
        imageLambda?: Record<string, string>;
        regenerationLambda?: Record<string, string>;
      };
  handler?: string;
  description?: string;
  policy?: string;
  domain?: string | string[];
  domainType?: "www" | "apex" | "both";
  domainRedirects?: { [key: string]: string };
  domainMinimumProtocolVersion?: string;
  cloudfront?: CloudfrontOptions;
  minifyHandlers?: boolean;
  uploadStaticAssetsFromBuild?: boolean;
  deploy?: boolean | string;
  enableHTTPCompression?: boolean;
  authentication?: { username: string; password: string };
  imageOptimizer?: boolean;
  certificateArn?: string;
  enableS3Acceleration?: boolean;
  sqs?: { name: string; tags: { [key: string]: string } };
  removeOldLambdaVersions?: boolean;
};

type CloudfrontOptions = Record<string, any>;

export type BuildOptions = {
  cwd?: string;
  enabled?: boolean | string;
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  postBuildCommands?: string[];
  baseDir?: string;
  cleanupDotNext?: boolean;
  assetIgnorePatterns?: string[];
  separateApiLambda?: boolean;
  disableOriginResponseHandler?: boolean;
  useV2Handler?: boolean;
};

export type LambdaType =
  | "defaultLambda"
  | "apiLambda"
  | "imageLambda"
  | "regenerationLambda";

export type LambdaInput = {
  description: string;
  handler: string;
  code: string;
  region?: string;
  role: Record<string, unknown>;
  memory: number;
  timeout: number;
  runtime: string;
  name?: string;
  tags: Record<string, string>;
};
