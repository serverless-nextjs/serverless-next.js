import { Component } from "@serverless/core";
import { readJSON, pathExists } from "fs-extra";
import { resolve, join } from "path";
import { Builder } from "@sls-next/lambda-at-edge";
import {
  OriginRequestDefaultHandlerManifest as BuildManifest,
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest,
  RoutesManifest
} from "@sls-next/lambda-at-edge/types";
import uploadAssetsToS3 from "@sls-next/s3-static-assets";
import createInvalidation from "@sls-next/cloudfront";
import obtainDomains from "./lib/obtainDomains";
import { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from "./constants";
import type {
  BuildOptions,
  ServerlessComponentInputs,
  LambdaType,
  LambdaInput
} from "../types";

type DeploymentResult = {
  appUrl: string;
  bucketName: string;
  distributionId: string;
};

class NextjsComponent extends Component {
  async default(
    inputs: ServerlessComponentInputs = {}
  ): Promise<DeploymentResult> {
    if (inputs.build !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
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

  async build(inputs: ServerlessComponentInputs = {}): Promise<void> {
    const nextConfigPath = inputs.nextConfigDir
      ? resolve(inputs.nextConfigDir)
      : process.cwd();

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
          minifyHandlers: inputs.minifyHandlers || false
        }
      );

      await builder.build(this.context.instance.debugMode);
    }
  }

  async deploy(
    inputs: ServerlessComponentInputs = {}
  ): Promise<DeploymentResult> {
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
      ...cloudFrontOtherInputs
    } = inputs.cloudfront || {};

    const bucketRegion = inputs.bucketRegion || "us-east-1";

    const [
      defaultBuildManifest,
      apiBuildManifest,
      routesManifest
    ] = await Promise.all([
      this.readDefaultBuildManifest(nextConfigPath),
      this.readApiBuildManifest(nextConfigPath),
      this.readRoutesManifest(nextConfigPath)
    ]);

    const [
      bucket,
      cloudFront,
      defaultEdgeLambda,
      apiEdgeLambda
    ] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@sls-next/aws-cloudfront"),
      this.load("@sls-next/aws-lambda", "defaultEdgeLambda"),
      this.load("@sls-next/aws-lambda", "apiEdgeLambda")
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName,
      region: bucketRegion
    });

    await uploadAssetsToS3({
      bucketName: bucketOutputs.name,
      basePath: routesManifest.basePath,
      nextConfigDir: nextConfigPath,
      nextStaticDir: nextStaticPath,
      credentials: this.context.credentials.aws,
      publicDirectoryCache: inputs.publicDirectoryCache
    });

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
          Resource: `arn:aws:s3:::${bucketOutputs.name}/*`,
          Action: ["s3:GetObject", "s3:PutObject"]
        }
      ]
    };

    if (inputs.policy) {
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
        handler: "index.handler",
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
        role: {
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

    const defaultEdgeLambdaInput: LambdaInput = {
      description:
        inputs.description ||
        "Default Lambda@Edge for Next CloudFront distribution",
      handler: "index.handler",
      code: join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR),
      role:
        inputs.role && inputs.role.defaultArn
          ? inputs.role
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

    const defaultEdgeLambdaOutputs = await defaultEdgeLambda(
      defaultEdgeLambdaInput
    );

    const defaultEdgeLambdaPublishOutputs = await defaultEdgeLambda.publishVersion();

    // validate that the custom config paths match generated paths in the manifest
    this.validatePathPatterns(
      Object.keys(cloudFrontOtherInputs),
      defaultBuildManifest,
      routesManifest
    );

    // Add any custom cloudfront configuration
    // this includes overrides for _next, static and api
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

    cloudFrontOrigins[0].pathPatterns[
      this.pathPattern("_next/data/*", routesManifest)
    ] = {
      minTTL: 0,
      defaultTTL: 0,
      maxTTL: 31536000,
      allowedHttpMethods: ["HEAD", "GET"],
      "lambda@edge": {
        "origin-response": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`,
        "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
      }
    };

    // make sure that origin-response is not set.
    // this is reserved for serverless-next.js usage
    const cloudFrontDefaults = cloudFrontDefaultsInputs || {};

    const defaultLambdaAtEdgeConfig = {
      ...(cloudFrontDefaults["lambda@edge"] || {})
    };
    delete defaultLambdaAtEdgeConfig["origin-response"];

    const cloudFrontOutputs = await cloudFront({
      distributionId: cloudFrontDistributionId,
      defaults: {
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
      },
      origins: cloudFrontOrigins,
      ...(cloudFrontAliasesInputs && {
        aliases: cloudFrontAliasesInputs
      }),
      ...(cloudFrontPriceClassInputs && {
        priceClass: cloudFrontPriceClassInputs
      }),
      ...(cloudFrontErrorPagesInputs && {
        errorPages: cloudFrontErrorPagesInputs
      })
    });

    let appUrl = cloudFrontOutputs.url;

    await createInvalidation({
      distributionId: cloudFrontOutputs.id,
      credentials: this.context.credentials.aws
    });

    const { domain, subdomain } = obtainDomains(inputs.domain);
    if (domain && subdomain) {
      const domainComponent = await this.load("@sls-next/domain");
      const domainOutputs = await domainComponent({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: cloudFrontOutputs
        },
        domainType: inputs.domainType || "both",
        defaultCloudfrontInputs: cloudFrontDefaults
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
      this.load("@sls-next/aws-cloudfront"),
      this.load("@sls-next/domain")
    ]);

    await bucket.remove();
    await cloudfront.remove();
    await domain.remove();
  }
}

export default NextjsComponent;
