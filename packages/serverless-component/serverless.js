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
      credentials: this.context.credentials
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
    //
    // Parse origins from inputs
    const inputOrigins = (
      (inputs.cloudfront && inputs.cloudfront.origins) ||
      []
    ).map(expandRelativeUrls);

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
        description: "API Lambda@Edge for Next CloudFront distribution",
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
      const apiCloudfrontInputs =
        (inputs.cloudfront && inputs.cloudfront.api) || {};
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
        ...apiCloudfrontInputs,
        // lambda@edge key is last and therefore cannot be overridden
        "lambda@edge": {
          "origin-request": `${apiEdgeLambdaOutputs.arn}:${apiEdgeLambdaPublishOutputs.version}`
        }
      };
    }

    const defaultEdgeLambdaInput = {
      description: "Default Lambda@Edge for Next CloudFront distribution",
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

    const defaultCloudfrontInputs =
      (inputs.cloudfront && inputs.cloudfront.defaults) || {};
    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 0,
        allowedHttpMethods: ["HEAD", "GET"],
        ...defaultCloudfrontInputs,
        forward: {
          cookies: "all",
          queryString: true,
          cookies: "all",
          queryString: true,
          ...defaultCloudfrontInputs.forward
        },
        // lambda@edge key is last and therefore cannot be overridden
        "lambda@edge": {
          "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
        }
      },
      origins: cloudFrontOrigins
    });

    let appUrl = cloudFrontOutputs.url;

    // Create domain
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
