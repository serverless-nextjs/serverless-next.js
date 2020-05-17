const { Component } = require("@serverless/core");
const fse = require("fs-extra");
const path = require("path");
const { Builder } = require("@sls-next/lambda-at-edge");
const uploadAssetsToS3 = require("@sls-next/s3-static-assets");

const obtainDomains = require("./lib/obtainDomains");
const { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } = require("./constants");
const join = path.join;

class NextjsComponent extends Component {
  async default(inputs = {}) {
    if (inputs.build !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
  }

  readDefaultBuildManifest(nextConfigPath) {
    return fse.readJSON(
      join(nextConfigPath, ".serverless_nextjs/default-lambda/manifest.json")
    );
  }

  validatePathPatterns(pathPatterns, buildManifest) {
    let stillToMatch = new Set(pathPatterns);
    if (stillToMatch.size !== pathPatterns.length) {
      throw Error("Duplicate path declared in cloudfront configuration");
    }

    // there wont be a page path for this so we can remove it
    stillToMatch.delete("api/*");
    // check for other api like paths
    for (const path of stillToMatch) {
      if (/^(\/?api\/.*|\/?api)$/.test(path)) {
        throw Error(
          `Setting custom cache behaviour for api/ route "${path}" is not supported`
        );
      }
    }

    // theres a lot of n^2 code running below but n is small and it only runs once so we can
    // accept it

    // setup containers for the paths we're going to be matching against

    // for dynamic routes
    let manifestRegex = [];
    // for static routes
    let manifestPaths = new Set();

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
    // paths with stars (*) shouldnt cause any issues because the regex will treat these
    // as characters.
    manifestRegex.forEach(re => {
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
        if (new RegExp(pathToMatch).test(path)) {
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

  async readApiBuildManifest(nextConfigPath) {
    const path = join(
      nextConfigPath,
      ".serverless_nextjs/api-lambda/manifest.json"
    );
    return (await fse.exists(path))
      ? fse.readJSON(path)
      : Promise.resolve(undefined);
  }

  async build(inputs = {}) {
    const nextConfigPath = inputs.nextConfigDir
      ? path.resolve(inputs.nextConfigDir)
      : process.cwd();

    const buildConfig = {
      enabled: inputs.build
        ? inputs.build !== false && inputs.build.enabled !== false
        : true,
      cmd: "node_modules/.bin/next",
      args: ["build"],
      ...(typeof inputs.build === "object" ? inputs.build : {}),
      cwd:
        inputs.build && inputs.build.cwd
          ? path.resolve(inputs.build.cwd)
          : nextConfigPath
    };

    if (buildConfig.enabled) {
      const builder = new Builder(
        nextConfigPath,
        join(nextConfigPath, ".serverless_nextjs"),
        {
          cmd: buildConfig.cmd,
          cwd: buildConfig.cwd,
          env: buildConfig.env,
          args: buildConfig.args
        }
      );

      await builder.build();
    }
  }

  async deploy(inputs = {}) {
    const nextConfigPath = inputs.nextConfigDir
      ? path.resolve(inputs.nextConfigDir)
      : process.cwd();
    const nextStaticPath = inputs.nextStaticDir
      ? path.resolve(inputs.nextStaticDir)
      : nextConfigPath;

    const customCloudFrontConfig = inputs.cloudfront || {};

    const [defaultBuildManifest, apiBuildManifest] = await Promise.all([
      this.readDefaultBuildManifest(nextConfigPath),
      this.readApiBuildManifest(nextConfigPath)
    ]);

    const [
      bucket,
      cloudFront,
      defaultEdgeLambda,
      apiEdgeLambda
    ] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@serverless/aws-cloudfront"),
      this.load("@serverless/aws-lambda", "defaultEdgeLambda"),
      this.load("@serverless/aws-lambda", "apiEdgeLambda")
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName
    });

    await uploadAssetsToS3.default({
      bucketName: bucketOutputs.name,
      nextConfigDir: nextConfigPath,
      nextStaticDir: nextStaticPath,
      credentials: this.context.credentials.aws,
      publicDirectoryCache: inputs.publicDirectoryCache
    });

    defaultBuildManifest.cloudFrontOrigins = {
      staticOrigin: {
        domainName: `${bucketOutputs.name}.s3.amazonaws.com`
      }
    };

    const bucketUrl = `http://${bucketOutputs.name}.s3.amazonaws.com`;

    // If origin is relative path then prepend the bucketUrl
    // e.g. /path => http://bucket.s3.aws.com/path
    const expandRelativeUrls = origin => {
      const originUrl = typeof origin === "string" ? origin : origin.url;
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
    let inputOrigins = [];
    if (inputs.cloudfront && inputs.cloudfront.origins) {
      inputOrigins = inputs.cloudfront.origins.map(expandRelativeUrls);
      delete inputs.cloudfront.origins;
    }

    const cloudFrontOrigins = [
      {
        url: bucketUrl,
        private: true,
        pathPatterns: {
          "_next/*": {
            ttl: 86400
          },
          "static/*": {
            ttl: 86400
          }
        }
      },
      ...inputOrigins
    ];

    let apiEdgeLambdaOutputs;
    let apiEdgeLambdaPublishOutputs;

    const hasAPIPages =
      apiBuildManifest &&
      (Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
        Object.keys(apiBuildManifest.apis.dynamic).length > 0);

    const getLambdaMemory = lambdaType =>
      typeof inputs.memory === "number"
        ? inputs.memory
        : (inputs.memory && inputs.memory[lambdaType]) || 512;

    const getLambdaTimeout = lambdaType =>
      typeof inputs.timeout === "number"
        ? inputs.timeout
        : (inputs.timeout && inputs.timeout[lambdaType]) || 10;

    const getLambdaName = lambdaType =>
      typeof inputs.name === "string"
        ? inputs.name
        : inputs.name && inputs.name[lambdaType];

    if (hasAPIPages) {
      const apiEdgeLambdaInput = {
        description: inputs.description
          ? `${inputs.description} (API)`
          : "API Lambda@Edge for Next CloudFront distribution",
        handler: "index.handler",
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn:
              inputs.policy ||
              "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
          }
        },
        memory: getLambdaMemory("apiLambda"),
        timeout: getLambdaTimeout("apiLambda")
      };
      const apiLambdaName = getLambdaName("apiLambda");
      if (apiLambdaName) apiEdgeLambdaInput.name = apiLambdaName;

      apiEdgeLambdaOutputs = await apiEdgeLambda(apiEdgeLambdaInput);

      apiEdgeLambdaPublishOutputs = await apiEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns["api/*"] = {
        ttl: 0,
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

    const defaultEdgeLambdaInput = {
      description:
        inputs.description ||
        "Default Lambda@Edge for Next CloudFront distribution",
      handler: "index.handler",
      code: join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR),
      role: {
        service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
        policy: {
          arn:
            inputs.policy ||
            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        }
      },
      memory: getLambdaMemory("defaultLambda"),
      timeout: getLambdaTimeout("defaultLambda")
    };
    const defaultLambdaName = getLambdaName("defaultLambda");
    if (defaultLambdaName) defaultEdgeLambdaInput.name = defaultLambdaName;

    const defaultEdgeLambdaOutputs = await defaultEdgeLambda(
      defaultEdgeLambdaInput
    );

    const defaultEdgeLambdaPublishOutputs = await defaultEdgeLambda.publishVersion();

    let defaultCloudfrontInputs;
    if (inputs.cloudfront && inputs.cloudfront.defaults) {
      defaultCloudfrontInputs = inputs.cloudfront.defaults;
      delete inputs.cloudfront.defaults;
    } else {
      defaultCloudfrontInputs = {};
    }

    // validate that the custom config paths match generated paths in the manifest
    this.validatePathPatterns(
      Object.keys(customCloudFrontConfig),
      defaultBuildManifest
    );

    // add any custom cloudfront configuration
    // this includes overrides for _next, static and api
    Object.entries(customCloudFrontConfig).map(([path, config]) => {
      cloudFrontOrigins[0].pathPatterns[path] = {
        // spread the existing value if there is one
        ...cloudFrontOrigins[0].pathPatterns[path],
        // spread custom config
        ...config,
        "lambda@edge": {
          ...(config["lambda@edge"] || {}),
          "origin-request":
            // dont set if the path is static or _next
            // spread the supplied overrides
            !["static/*", "_next/*"].includes(path) &&
            `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
        }
      };
    });

    // make sure that origin-response is not set.
    // this is reserved for serverless-next.js usage
    let defaultLambdaAtEdgeConfig = {
      ...(defaultCloudfrontInputs["lambda@edge"] || {})
    };
    delete defaultLambdaAtEdgeConfig["origin-response"];

    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 0,
        forward: {
          cookies: "all",
          queryString: true,
          ...defaultCloudfrontInputs.forward
        },
        ...defaultCloudfrontInputs,
        // everything after here cant be overriden
        allowedHttpMethods: ["HEAD", "GET"],
        "lambda@edge": {
          ...defaultLambdaAtEdgeConfig,
          "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
        }
      },
      origins: cloudFrontOrigins
    });

    let appUrl = cloudFrontOutputs.url;

    // create domain
    const { domain, subdomain } = obtainDomains(inputs.domain);
    if (domain) {
      const domainComponent = await this.load("@serverless/domain");
      const domainOutputs = await domainComponent({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: cloudFrontOutputs
        }
      });
      appUrl = domainOutputs.domains[0];
    }

    return {
      appUrl,
      bucketName: bucketOutputs.name
    };
  }

  async remove() {
    const [bucket, cloudfront, domain] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@serverless/aws-cloudfront"),
      this.load("@serverless/domain")
    ]);

    await Promise.all([bucket.remove(), cloudfront.remove(), domain.remove()]);
  }
}

module.exports = NextjsComponent;
