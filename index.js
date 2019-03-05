"use strict";

const path = require("path");
const addS3BucketToResources = require("./lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("./lib/uploadStaticAssetsToS3");
const displayStackOutput = require("./lib/displayStackOutput");
const parseNextConfiguration = require("./lib/parseNextConfiguration");
const build = require("./lib/build");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);

    this.commands = {};

    this.beforeCreateDeploymentArtifacts = this.beforeCreateDeploymentArtifacts.bind(
      this
    );

    this.afterUploadArtifacts = this.afterUploadArtifacts.bind(this);
    this.afterDisplayStackOutputs = this.afterDisplayStackOutputs.bind(this);
    this.beforePackageInitialize = this.beforePackageInitialize.bind(this);

    this.hooks = {
      "before:package:initialize": this.beforePackageInitialize,
      "before:package:createDeploymentArtifacts": this
        .beforeCreateDeploymentArtifacts,
      "after:aws:deploy:deploy:uploadArtifacts": this.afterUploadArtifacts,
      "after:aws:info:displayStackOutputs": this.afterDisplayStackOutputs
    };
  }

  get nextConfigDir() {
    return this.getPluginConfigValue("nextConfigDir");
  }

  get configuration() {
    return parseNextConfiguration(this.nextConfigDir);
  }

  getPluginConfigValue(param) {
    return this.serverless.service.custom["serverless-nextjs"][param];
  }

  beforePackageInitialize() {
    return build(this.nextConfigDir).then(nextPages =>
      this.setNextPages(nextPages)
    );
  }

  setNextPages(nextPages) {
    const service = this.serverless.service;

    this.nextPages = nextPages;

    nextPages.forEach(page => {
      const functionName = page.functionName;
      const functionAlreadyDeclared = service.functions[functionName];

      if (!functionAlreadyDeclared) {
        service.functions[functionName] = page.serverlessFunction[functionName];
      }
    });

    this.serverless.service.setFunctionNames();
  }

  getCFTemplatesWithBucket(staticAssetsBucket) {
    return Promise.all([
      addS3BucketToResources(
        staticAssetsBucket,
        this.serverless.service.provider.compiledCloudFormationTemplate
      ),
      addS3BucketToResources(
        staticAssetsBucket,
        this.serverless.service.provider.coreCloudFormationTemplate
      )
    ]);
  }

  beforeCreateDeploymentArtifacts() {
    const { staticAssetsBucket } = this.configuration;

    return this.getCFTemplatesWithBucket(staticAssetsBucket).then(
      ([compiledCfWithBucket, coreCfWithBucket]) => {
        this.serverless.service.provider.compiledCloudFormationTemplate = compiledCfWithBucket;
        this.serverless.service.provider.coreCloudFormationTemplate = coreCfWithBucket;
      }
    );
  }

  afterUploadArtifacts() {
    const { nextConfiguration, staticAssetsBucket } = this.configuration;

    return uploadStaticAssetsToS3({
      staticAssetsPath: path.join(nextConfiguration.distDir, "static"),
      providerRequest: this.providerRequest,
      bucketName: staticAssetsBucket
    });
  }

  afterDisplayStackOutputs() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayStackOutput(awsInfo);
  }
}

module.exports = ServerlessNextJsPlugin;
