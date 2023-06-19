import { Component } from "@serverless/core";
import { pathExists, readJSON } from "fs-extra";
import { join, resolve } from "path";
import { Builder } from "@getjerry/lambda-at-edge";
import {
  OriginRequestApiHandlerManifest,
  OriginRequestDefaultHandlerManifest,
  OriginRequestDefaultHandlerManifest as BuildManifest,
  OriginRequestImageHandlerManifest,
  RoutesManifest
} from "@getjerry/lambda-at-edge/types";
import {
  deleteOldStaticAssets,
  uploadStaticAssets,
  uploadStaticAssetsFromBuild
} from "@getjerry/s3-static-assets";
import createInvalidation from "@getjerry/cloudfront";
import obtainDomains from "./lib/obtainDomains";
import { populateNames } from "./lib/populate-names";
import {
  API_LAMBDA_CODE_DIR,
  DEFAULT_LAMBDA_CODE_DIR,
  IMAGE_LAMBDA_CODE_DIR,
  RETRYABLE_UPDATE_CLOUDFRONT_DISTRIBUTION_ERRORS
} from "./constants";
import type {
  BuildOptions,
  LambdaInput,
  LambdaType,
  ServerlessComponentInputs
} from "../types";
import { execSync } from "child_process";
import isEmpty from "lodash/isEmpty";
import toNumber from "lodash/toNumber";
import promiseRetry from "promise-retry";
import { AWSError } from "aws-sdk";

// Message when deployment is explicitly skipped
const SKIPPED_DEPLOY = "SKIPPED_DEPLOY";

export type DeploymentResult = {
  appUrl: string;
  bucketName: string;
  distributionId: string;
};

// get invalidate path from basePath
function getPathsToInvalidate(basePath: string, cloudFrontPaths: any) {
  if (basePath === "") {
    return ["/*"];
  }
  return basePath ? [`${basePath}*`] : cloudFrontPaths;
}

class NextjsComponent extends Component {
  async default(
    inputs: ServerlessComponentInputs = {}
  ): Promise<DeploymentResult> {
    const params = populateNames(inputs);

    if (params.build !== false) {
      await this.build(params);
      await this.postBuild(params);
    }

    return this.deploy(params);
  }

  readDefaultBuildManifest(
    nextConfigPath: string
  ): Promise<OriginRequestDefaultHandlerManifest> {
    return readJSON(
      join(nextConfigPath, ".serverless_nextjs/default-lambda/manifest.json")
    );
  }

  readRoutesManifest(nextConfigPath: string): Promise<RoutesManifest> {
    return readJSON(join(nextConfigPath, ".next/routes-manifest.json"));
  }

  pathPattern(pattern: string, routesManifest: RoutesManifest): string {
    const basePath = routesManifest.basePath;
    if (isEmpty(basePath) && pattern === "api/*") {
      // for preview mode, if we do not set basePath, we need 'api/preview*'or 'api/preview' instead of 'api/*'
      // Because we should always keep 'api/*' point to backend project
      return "api/preview";
    }
    return basePath && basePath.length > 0
      ? `${basePath.slice(1)}/${pattern}`
      : pattern;
  }

  validatePathPatterns(
    pathPatterns: string[],
    buildManifest: BuildManifest,
    routesManifest: RoutesManifest
  ): void {
    const stillToMatch = new Set(pathPatterns);

    if (stillToMatch.size !== pathPatterns.length) {
      throw Error("Duplicate path declared in cloudfront configuration");
    }

    // there wont be pages for these paths for this so we can remove them
    stillToMatch.delete(this.pathPattern("api/*", routesManifest));
    stillToMatch.delete(this.pathPattern("static/*", routesManifest));
    stillToMatch.delete(this.pathPattern("_next/static/*", routesManifest));
    stillToMatch.delete(this.pathPattern("_next/data/*", routesManifest));

    // check for other api like paths
    for (const path of stillToMatch) {
      if (/^(\/?api\/.*|\/?api)$/.test(path)) {
        stillToMatch.delete(path);
      }
    }

    // setup containers for the paths we're going to be matching against

    // for dynamic routes
    const manifestRegex: RegExp[] = [];

    // for static routes
    const manifestPaths = new Set();

    // extract paths to validate against from build manifest
    const ssrDynamic = buildManifest.pages.ssr.dynamic || {};
    const ssrNonDynamic = buildManifest.pages.ssr.nonDynamic || {};
    const htmlDynamic = buildManifest.pages.html.dynamic || {};
    const htmlNonDynamic = buildManifest.pages.html.nonDynamic || {};

    // dynamic paths to check. We use their regex to match against our input yaml
    Object.entries({
      ...ssrDynamic,
      ...htmlDynamic
    }).map(([, { regex }]) => {
      manifestRegex.push(new RegExp(regex));
    });

    // static paths to check
    Object.entries({
      ...ssrNonDynamic,
      ...htmlNonDynamic
    }).map(([path]) => {
      manifestPaths.add(path);
    });

    // first we check if the path patterns match any of the dynamic page regex.
    // paths with stars (*) shouldn't cause any issues because the regex will treat these
    // as characters.
    manifestRegex.forEach((re) => {
      for (const path of stillToMatch) {
        if (re.test(path)) {
          stillToMatch.delete(path);
        }
      }
    });

    // now we check the remaining unmatched paths against the non dynamic paths
    // and use the path as regex so that we are testing *
    for (const pathToMatch of stillToMatch) {
      for (const path of manifestPaths) {
        if (new RegExp(pathToMatch).test(path as string)) {
          stillToMatch.delete(pathToMatch);
        }
      }
    }

    if (stillToMatch.size > 0) {
      throw Error(
        `CloudFront input failed validation. Could not find next.js pages for "${[
          ...stillToMatch
        ]}"`
      );
    }
  }

  async readApiBuildManifest(
    nextConfigPath: string
  ): Promise<OriginRequestApiHandlerManifest> {
    const path = join(
      nextConfigPath,
      ".serverless_nextjs/api-lambda/manifest.json"
    );

    return (await pathExists(path))
      ? readJSON(path)
      : Promise.resolve(undefined);
  }

  async readImageBuildManifest(
    nextConfigPath: string
  ): Promise<OriginRequestImageHandlerManifest> {
    const path = join(
      nextConfigPath,
      ".serverless_nextjs/image-lambda/manifest.json"
    );

    return (await pathExists(path))
      ? readJSON(path)
      : Promise.resolve(undefined);
  }

  async build(inputs: ServerlessComponentInputs = {}): Promise<void> {
    const nextConfigPath = inputs.nextConfigDir
      ? resolve(inputs.nextConfigDir)
      : process.cwd();

    const nextStaticPath = inputs.nextStaticDir
      ? resolve(inputs.nextStaticDir)
      : nextConfigPath;

    const buildCwd =
      typeof inputs.build === "boolean" ||
      typeof inputs.build === "undefined" ||
      !inputs.build.cwd
        ? nextConfigPath
        : resolve(inputs.build.cwd);

    const buildConfig: BuildOptions = {
      enabled: inputs.build
        ? // @ts-ignore
          inputs.build !== false && inputs.build.enabled !== false
        : true,
      cmd: "node_modules/.bin/next",
      args: ["build"],
      ...(typeof inputs.build === "object" ? inputs.build : {}),
      cwd: buildCwd
    };

    if (buildConfig.enabled) {
      const builder = new Builder(
        nextConfigPath,
        join(nextConfigPath, ".serverless_nextjs"),
        {
          cmd: buildConfig.cmd,
          cwd: buildConfig.cwd,
          env: buildConfig.env,
          args: buildConfig.args,
          useServerlessTraceTarget: inputs.useServerlessTraceTarget || false,
          logLambdaExecutionTimes: inputs.logLambdaExecutionTimes || false,
          domainRedirects: inputs.domainRedirects || {},
          canonicalHostname: inputs.canonicalHostname,
          //TODO make it work without distributionId specified
          distributionId: inputs.cloudfront?.distributionId,
          minifyHandlers: inputs.minifyHandlers || false,
          enableHTTPCompression: false,
          handler: inputs.handler
            ? `${inputs.handler.split(".")[0]}.js`
            : undefined,
          authentication: inputs.authentication ?? undefined,
          urlRewrites: inputs.urlRewrites ?? undefined,
          enableDebugMode: inputs.enableDebugMode ?? false,
          invalidationUrlGroups: inputs.invalidationUrlGroups ?? undefined,
          notFoundPageMark: inputs.notFoundPageMark ?? undefined,
          permanentStaticPages: inputs.permanentStaticPages ?? undefined,
          sentry: inputs.sentry
            ? {
                ...inputs.sentry,
                tracesSampleRate: toNumber(inputs.sentry.tracesSampleRate)
              }
            : undefined,
          abTests: inputs.abTests ?? undefined,
          enableRemoteInvalidation: inputs.enableRemoteInvalidation ?? false
        },
        nextStaticPath
      );

      await builder.build(this.context.instance.debugMode);
    }
  }

  /**
   * Run any post-build steps.
   * Useful to run any custom commands before deploying.
   * @param inputs
   */
  async postBuild(inputs: ServerlessComponentInputs): Promise<void> {
    const buildOptions = inputs.build;

    const postBuildCommands =
      (buildOptions as BuildOptions)?.postBuildCommands ?? [];

    for (const command of postBuildCommands) {
      execSync(command, { stdio: "inherit" });
    }
  }

  async deploy(
    inputs: ServerlessComponentInputs = {}
  ): Promise<DeploymentResult> {
    // Skip deployment if user explicitly set deploy input to false.
    // Useful when they just want the build outputs to deploy themselves.
    if (inputs.deploy === false) {
      return {
        appUrl: SKIPPED_DEPLOY,
        bucketName: SKIPPED_DEPLOY,
        distributionId: SKIPPED_DEPLOY
      };
    }

    const nextConfigPath = inputs.nextConfigDir
      ? resolve(inputs.nextConfigDir)
      : process.cwd();

    const nextStaticPath = inputs.nextStaticDir
      ? resolve(inputs.nextStaticDir)
      : nextConfigPath;

    const {
      defaults: cloudFrontDefaultsInputs,
      origins: cloudFrontOriginsInputs,
      aliases: cloudFrontAliasesInputs,
      priceClass: cloudFrontPriceClassInputs,
      errorPages: cloudFrontErrorPagesInputs,
      distributionId: cloudFrontDistributionId = null,
      comment: cloudFrontComment,
      webACLId: cloudFrontWebACLId,
      restrictions: cloudFrontRestrictions,
      certificate: cloudFrontCertificate,
      originAccessIdentityId: cloudFrontOriginAccessIdentityId,
      paths: cloudFrontPaths,
      ...cloudFrontOtherInputs
    } = inputs.cloudfront || {};

    const bucketRegion = inputs.bucketRegion || "us-east-1";

    const staticCachePolicyId = inputs.staticCachePolicyId;
    const staticOriginRequestPolicyId = inputs.staticOriginRequestPolicyId;
    const nextImageLoader = inputs.nextImageLoader;
    const dynamicCachePolicyId = inputs.dynamicCachePolicyId;
    const dynamicOriginRequestPolicyId = inputs.dynamicOriginRequestPolicyId;

    const [
      defaultBuildManifest,
      apiBuildManifest,
      imageBuildManifest,
      routesManifest
    ] = await Promise.all([
      this.readDefaultBuildManifest(nextConfigPath),
      this.readApiBuildManifest(nextConfigPath),
      this.readImageBuildManifest(nextConfigPath),
      this.readRoutesManifest(nextConfigPath)
    ]);

    const [
      bucket,
      cloudFront,
      defaultEdgeLambda,
      apiEdgeLambda,
      imageEdgeLambda
    ] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@getjerry/aws-cloudfront"),
      this.load("@getjerry/aws-lambda", "defaultEdgeLambda"),
      this.load("@getjerry/aws-lambda", "apiEdgeLambda"),
      this.load("@getjerry/aws-lambda", "imageEdgeLambda")
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName,
      region: bucketRegion
    });

    // If new BUILD_ID file is present, remove all versioned assets but the existing build ID's assets, to save S3 storage costs.
    // After deployment, only the new and previous build ID's assets are present. We still need previous build assets as it takes time to propagate the Lambda.
    await deleteOldStaticAssets({
      bucketName: bucketOutputs.name,
      basePath: routesManifest.basePath,
      credentials: this.context.credentials.aws
    });

    // This input is intentionally undocumented but it acts a short-term killswitch in case of any issues with uploading from the built assets.
    // TODO: remove once proven stable.
    if (inputs.uploadStaticAssetsFromBuild ?? true) {
      // Summarize the page path involved in the A/B Test
      const abTestPaths = inputs.abTests?.reduce((acc, cur) => {
        acc.push(cur.originUrl, ...cur.experimentGroups.map((_) => _.url));
        return acc;
      }, [] as string[]);

      await uploadStaticAssetsFromBuild({
        bucketName: bucketOutputs.name,
        basePath: routesManifest.basePath,
        nextConfigDir: nextConfigPath,
        nextStaticDir: nextStaticPath,
        credentials: this.context.credentials.aws,
        publicDirectoryCache: inputs.publicDirectoryCache,
        abTestPaths
      });
    } else {
      await uploadStaticAssets({
        bucketName: bucketOutputs.name,
        basePath: routesManifest.basePath,
        nextConfigDir: nextConfigPath,
        nextStaticDir: nextStaticPath,
        credentials: this.context.credentials.aws,
        publicDirectoryCache: inputs.publicDirectoryCache
      });
    }

    const bucketUrl = `http://${bucketOutputs.name}.s3.${bucketRegion}.amazonaws.com`;

    // if origin is relative path then prepend the bucketUrl
    // e.g. /path => http://bucket.s3.aws.com/path
    const expandRelativeUrls = (origin: string | Record<string, unknown>) => {
      const originUrl =
        typeof origin === "string" ? origin : (origin.url as string);
      const fullOriginUrl =
        originUrl.charAt(0) === "/" ? `${bucketUrl}${originUrl}` : originUrl;

      if (typeof origin === "string") {
        return fullOriginUrl;
      } else {
        return {
          ...origin,
          url: fullOriginUrl
        };
      }
    };

    // parse origins from inputs
    let inputOrigins: any[] = [];
    if (cloudFrontOriginsInputs) {
      const origins = cloudFrontOriginsInputs as string[];
      inputOrigins = origins.map(expandRelativeUrls);
    }

    const cloudFrontOrigins = [
      {
        url: bucketUrl,
        private: true,
        pathPatterns: {}
      },
      ...inputOrigins
    ];

    cloudFrontOrigins[0].pathPatterns[
      this.pathPattern("_next/static/*", routesManifest)
    ] = {
      cachePolicyId: staticCachePolicyId,
      originRequestPolicyId: staticOriginRequestPolicyId,
      minTTL: 0,
      defaultTTL: 86400,
      maxTTL: 31536000,
      forward: {
        headers: "none",
        cookies: "none",
        queryString: false
      }
    };

    cloudFrontOrigins[0].pathPatterns[
      this.pathPattern("static/*", routesManifest)
    ] = {
      cachePolicyId: staticCachePolicyId,
      originRequestPolicyId: staticOriginRequestPolicyId,
      minTTL: 0,
      defaultTTL: 86400,
      maxTTL: 31536000,
      forward: {
        headers: "none",
        cookies: "none",
        queryString: false
      }
    };

    const hasAPIPages =
      apiBuildManifest &&
      (Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
        Object.keys(apiBuildManifest.apis.dynamic).length > 0);

    const readLambdaInputValue = (
      inputKey: "memory" | "timeout" | "name" | "runtime",
      lambdaType: LambdaType,
      defaultValue: string | number | undefined
    ): string | number | undefined => {
      const inputValue = inputs[inputKey];

      if (typeof inputValue === "string" || typeof inputValue === "number") {
        return inputValue;
      }

      if (!inputValue) {
        return defaultValue;
      }

      return inputValue[lambdaType] || defaultValue;
    };

    // default policy
    let policy: Record<string, unknown> = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Resource: "*",
          Action: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
        },
        {
          Effect: "Allow",
          Resource: "*",
          Action: ["lambda:InvokeFunction"]
        },
        {
          Effect: "Allow",
          Resource: "*",
          Action: ["cloudfront:CreateInvalidation"]
        },
        {
          Effect: "Allow",
          Resource: `arn:aws:s3:::${bucketOutputs.name}/*`,
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        }
      ]
    };

    if (inputs.policy) {
      this.context.debug(`Input policy: ${JSON.stringify(inputs.policy)}`);
      if (typeof inputs.policy === "string") {
        policy = { arn: inputs.policy };
      } else {
        policy = inputs.policy;
      }
    }

    if (hasAPIPages) {
      const apiEdgeLambdaInput: LambdaInput = {
        description: inputs.description
          ? `${inputs.description} (API)`
          : "API Lambda@Edge for Next CloudFront distribution",
        handler: inputs.handler || "index.handler",
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
        role: inputs.roleArn
          ? {
              arn: inputs.roleArn
            }
          : {
              service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
              policy
            },
        memory: readLambdaInputValue("memory", "apiLambda", 512) as number,
        timeout: readLambdaInputValue("timeout", "apiLambda", 10) as number,
        runtime: readLambdaInputValue(
          "runtime",
          "apiLambda",
          "nodejs12.x"
        ) as string,
        name: readLambdaInputValue("name", "apiLambda", undefined) as
          | string
          | undefined
      };

      const apiEdgeLambdaOutputs = await apiEdgeLambda(apiEdgeLambdaInput);

      const apiEdgeLambdaPublishOutputs = await apiEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns[
        this.pathPattern("api/*", routesManifest)
      ] = {
        cachePolicyId: dynamicCachePolicyId,
        originRequestPolicyId: dynamicOriginRequestPolicyId,
        minTTL: 0,
        defaultTTL: 0,
        maxTTL: 31536000,
        allowedHttpMethods: [
          "HEAD",
          "DELETE",
          "POST",
          "GET",
          "OPTIONS",
          "PUT",
          "PATCH"
        ],
        // lambda@edge key is last and therefore cannot be overridden
        "lambda@edge": {
          "origin-request": `${apiEdgeLambdaOutputs.arn}:${apiEdgeLambdaPublishOutputs.version}`
        }
      };
    }

    if (imageBuildManifest) {
      const imageEdgeLambdaInput: LambdaInput = {
        description: inputs.description
          ? `${inputs.description} (Image)`
          : "Image Lambda@Edge for Next CloudFront distribution",
        handler: inputs.handler || "index.handler",
        code: join(nextConfigPath, IMAGE_LAMBDA_CODE_DIR),
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy
        },
        memory: readLambdaInputValue("memory", "imageLambda", 512) as number,
        timeout: readLambdaInputValue("timeout", "imageLambda", 10) as number,
        runtime: readLambdaInputValue(
          "runtime",
          "imageLambda",
          "nodejs12.x"
        ) as string,
        name: readLambdaInputValue("name", "imageLambda", undefined) as
          | string
          | undefined
      };

      const imageEdgeLambdaOutputs = await imageEdgeLambda(
        imageEdgeLambdaInput
      );

      const imageEdgeLambdaPublishOutputs =
        await imageEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns[
        this.pathPattern("_next/image*", routesManifest)
      ] = {
        cachePolicyId:
          nextImageLoader?.cachePolicyId ||
          cloudFrontDefaultsInputs?.cachePolicyId,
        originRequestPolicyId:
          nextImageLoader?.originRequestPolicyId || staticOriginRequestPolicyId,
        minTTL: 0,
        defaultTTL: 60,
        maxTTL: 31536000,
        allowedHttpMethods: [
          "HEAD",
          "DELETE",
          "POST",
          "GET",
          "OPTIONS",
          "PUT",
          "PATCH"
        ],
        forward: {
          headers: ["Accept"]
        },
        "lambda@edge": {
          "origin-request": `${imageEdgeLambdaOutputs.arn}:${imageEdgeLambdaPublishOutputs.version}`
        }
      };
    }

    const defaultEdgeLambdaInput: LambdaInput = {
      description:
        inputs.description ||
        "Default Lambda@Edge for Next CloudFront distribution",
      handler: inputs.handler || "index.handler",
      code: join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR),
      role: inputs.roleArn
        ? {
            arn: inputs.roleArn
          }
        : {
            service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
            policy
          },
      memory: readLambdaInputValue("memory", "defaultLambda", 512) as number,
      timeout: readLambdaInputValue("timeout", "defaultLambda", 10) as number,
      runtime: readLambdaInputValue(
        "runtime",
        "defaultLambda",
        "nodejs12.x"
      ) as string,
      name: readLambdaInputValue("name", "defaultLambda", undefined) as
        | string
        | undefined
    };

    this.context.debug(
      `Default lambda input: ${JSON.stringify(defaultEdgeLambdaInput)}`
    );

    const defaultEdgeLambdaOutputs = await defaultEdgeLambda(
      defaultEdgeLambdaInput
    );

    const defaultEdgeLambdaPublishOutputs =
      await defaultEdgeLambda.publishVersion();

    cloudFrontOrigins[0].pathPatterns[
      this.pathPattern("_next/data/*", routesManifest)
    ] = {
      cachePolicyId: cloudFrontDefaultsInputs?.cachePolicyId,
      originRequestPolicyId: dynamicOriginRequestPolicyId,
      minTTL: 0,
      defaultTTL: 0,
      maxTTL: 31536000,
      allowedHttpMethods: ["HEAD", "GET"],
      "lambda@edge": {
        "origin-response": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`,
        "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
      }
    };

    // validate that the custom config paths match generated paths in the manifest
    this.validatePathPatterns(
      Object.keys(cloudFrontOtherInputs),
      defaultBuildManifest,
      routesManifest
    );

    // Add any custom cloudfront configuration
    // this includes overrides for _next/data/*, _next/static/*, static/*, api/*, and default cache behaviors
    Object.entries(cloudFrontOtherInputs).map(([path, config]) => {
      const edgeConfig = {
        ...(config["lambda@edge"] || {})
      };

      // here we are removing configs that cannot be overridden
      if (path === this.pathPattern("api/*", routesManifest)) {
        // for "api/*" we need to make sure we aren't overriding the predefined lambda handler
        // delete is idempotent so it's safe
        delete edgeConfig["origin-request"];
      } else if (!["static/*", "_next/*"].includes(path)) {
        // for everything but static/* and _next/* we want to ensure that they are pointing at our lambda
        edgeConfig[
          "origin-request"
        ] = `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`;
      }

      cloudFrontOrigins[0].pathPatterns[path] = {
        // spread the existing value if there is one
        ...cloudFrontOrigins[0].pathPatterns[path],
        // spread custom config
        ...config,
        "lambda@edge": {
          // spread the provided value
          ...(cloudFrontOrigins[0].pathPatterns[path] &&
            cloudFrontOrigins[0].pathPatterns[path]["lambda@edge"]),
          // then overrides
          ...edgeConfig
        }
      };
    });

    // make sure that origin-response is not set.
    // this is reserved for serverless-next.js usage
    const cloudFrontDefaults = cloudFrontDefaultsInputs || {};

    const defaultLambdaAtEdgeConfig = {
      ...(cloudFrontDefaults["lambda@edge"] || {})
    };
    delete defaultLambdaAtEdgeConfig["origin-response"];

    const defaultBehaviour = {
      cachePolicyId: cloudFrontDefaults.cachePolicyId,
      originRequestPolicyId: cloudFrontDefaults.originRequestPolicyId,
      viewerProtocolPolicy: "redirect-to-https",
      minTTL: 0,
      defaultTTL: 0,
      maxTTL: 31536000,
      ...cloudFrontDefaults,
      forward: {
        cookies: "all",
        queryString: true,
        ...cloudFrontDefaults.forward
      },
      // everything after here cant be overridden
      allowedHttpMethods: [
        "HEAD",
        "DELETE",
        "POST",
        "GET",
        "OPTIONS",
        "PUT",
        "PATCH"
      ],
      "lambda@edge": {
        ...defaultLambdaAtEdgeConfig,
        "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`,
        "origin-response": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
      },
      compress: true
    };
    const defaults = !routesManifest.basePath && defaultBehaviour;

    if (!defaults) {
      cloudFrontOrigins[0].pathPatterns[
        `${routesManifest.basePath.substr(1)}*`
      ] = defaultBehaviour;
    }

    const cloudFrontOutputs = await promiseRetry(
      {
        // max retry count
        retries: 10,
        // with jitter
        randomize: true,
        // first retry start with 5s delay
        minTimeout: 5 * 1000,
        // max delay between retries is 2min
        maxTimeout: 120 * 1000
      },
      async (retry, attempt) =>
        cloudFront({
          distributionId: cloudFrontDistributionId,
          defaults,
          origins: cloudFrontOrigins,
          ...(cloudFrontAliasesInputs && {
            aliases: cloudFrontAliasesInputs
          }),
          ...(cloudFrontPriceClassInputs && {
            priceClass: cloudFrontPriceClassInputs
          }),
          ...(cloudFrontErrorPagesInputs && {
            errorPages: cloudFrontErrorPagesInputs
          }),
          comment: cloudFrontComment,
          webACLId: cloudFrontWebACLId,
          restrictions: cloudFrontRestrictions,
          certificate: cloudFrontCertificate,
          originAccessIdentityId: cloudFrontOriginAccessIdentityId
        }).catch((error: unknown) => {
          const code = (error as AWSError).code;

          const shouldRetry =
            // has code
            code &&
            // code indicates one of retryable errors
            RETRYABLE_UPDATE_CLOUDFRONT_DISTRIBUTION_ERRORS.includes(code);

          if (shouldRetry) {
            this.context.debug(
              `Update CloudFront retrying: attempt ${attempt}`
            );
            this.context.debug(`retrying because error: ${code}`);
            retry(error);
          }

          throw error;
        })
    );

    let appUrl = cloudFrontOutputs.url;

    const pathsToInvalidate = getPathsToInvalidate(
      routesManifest.basePath,
      cloudFrontPaths
    );

    if (pathsToInvalidate && pathsToInvalidate.length) {
      await createInvalidation({
        distributionId: cloudFrontOutputs.id,
        credentials: this.context.credentials.aws,
        paths: pathsToInvalidate
      });
    }

    const { domain, subdomain } = obtainDomains(inputs.domain);
    if (domain && subdomain) {
      const domainComponent = await this.load("@getjerry/domain");
      const domainOutputs = await domainComponent({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: cloudFrontOutputs
        },
        domainType: inputs.domainType || "both",
        defaultCloudfrontInputs: cloudFrontDefaults,
        certificateArn: inputs.certificateArn
      });
      appUrl = domainOutputs.domains[0];
    }

    return {
      appUrl,
      bucketName: bucketOutputs.name,
      distributionId: cloudFrontOutputs.id
    };
  }

  async remove(): Promise<void> {
    const [bucket, cloudfront, domain] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@getjerry/aws-cloudfront"),
      this.load("@getjerry/domain")
    ]);

    await bucket.remove();
    await cloudfront.remove();
    await domain.remove();
  }
}

export default NextjsComponent;
