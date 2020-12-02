import { PublicDirectoryCache } from "@sls-next/s3-static-assets/src/lib/getPublicAssetCacheControl";

export type ServerlessComponentInputs = {
  build?: BuildOptions | boolean;
  nextConfigDir?: string;
  useServerlessTraceTarget?: boolean;
  logLambdaExecutionTimes?: boolean;
  nextStaticDir?: string;
  bucketName?: string;
  bucketRegion?: string;
  publicDirectoryCache?: PublicDirectoryCache;
  memory?:
    | number
    | { defaultLambda?: number; apiLambda?: number; imageLambda?: number };
  timeout?:
    | number
    | { defaultLambda?: number; apiLambda?: number; imageLambda?: number };
  name?:
    | string
    | { defaultLambda?: string; apiLambda?: string; imageLambda?: string };
  runtime?:
    | string
    | { defaultLambda?: string; apiLambda?: string; imageLambda?: string };
  handler?: string;
  description?: string;
  policy?: string;
  roleArn?: string;
  domain?: string | string[];
  domainType?: "www" | "apex" | "both";
  domainRedirects?: { [key: string]: string };
  cloudfront?: CloudfrontOptions;
  minifyHandlers?: boolean;
  uploadStaticAssetsFromBuild?: boolean;
  deploy?: boolean;
  enableHTTPCompression?: boolean;
  authentication?: { username: string; password: string };
  imageOptimizer?: boolean;
  certificateArn?: string;
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
