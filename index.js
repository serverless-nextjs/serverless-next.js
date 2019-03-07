"use strict";

const path = require("path");
const addS3BucketToResources = require("./lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("./lib/uploadStaticAssetsToS3");
const displayStackOutput = require("./lib/displayStackOutput");
const parseNextConfiguration = require("./lib/parseNextConfiguration");
const build = require("./lib/build");
const logger = require("./utils/logger");
const PluginBuildDir = require("./classes/PluginBuildDir");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {};

    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);
    this.pluginBuildDir = new PluginBuildDir(this.nextConfigDir);

    this.addStaticAssetsBucket = this.addStaticAssetsBucket.bind(this);
    this.uploadStaticAssets = this.uploadStaticAssets.bind(this);
    this.printStackOutput = this.printStackOutput.bind(this);
    this.buildNextPages = this.buildNextPages.bind(this);
    this.removePluginBuildDir = this.removePluginBuildDir.bind(this);

    this.hooks = {
      "before:package:initialize": this.buildNextPages,
      "before:package:createDeploymentArtifacts": this.addStaticAssetsBucket,
      "after:package:createDeploymentArtifacts": this.removePluginBuildDir,
      "before:deploy:function:initialize": this.buildNextPages,
      "after:aws:deploy:deploy:uploadArtifacts": this.uploadStaticAssets,
      "after:aws:info:displayStackOutputs": this.printStackOutput
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

  buildNextPages() {
    const pluginBuildDir = this.pluginBuildDir;
    const servicePackage = this.serverless.service.package;

    servicePackage.include = servicePackage.include || [];
    servicePackage.include.push(path.join(pluginBuildDir.buildDir, "*"));

    return build(pluginBuildDir).then(nextPages =>
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

  async addStaticAssetsBucket() {
    const { staticAssetsBucket } = this.configuration;

    if (!staticAssetsBucket) {
      return;
    }

    logger.log(`Found bucket "${staticAssetsBucket}" in assetPrefix!`);

    const [
      compiledCfWithBucket,
      coreCfWithBucket
    ] = await this.getCFTemplatesWithBucket(staticAssetsBucket);

    this.serverless.service.provider.compiledCloudFormationTemplate = compiledCfWithBucket;
    this.serverless.service.provider.coreCloudFormationTemplate = coreCfWithBucket;
  }

  uploadStaticAssets() {
    const { nextConfiguration, staticAssetsBucket } = this.configuration;

    if (!staticAssetsBucket) {
      return Promise.resolve();
    }

    return uploadStaticAssetsToS3({
      staticAssetsPath: path.join(nextConfiguration.distDir, "static"),
      providerRequest: this.providerRequest,
      bucketName: staticAssetsBucket
    });
  }

  printStackOutput() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayStackOutput(awsInfo);
  }

  removePluginBuildDir() {
    return this.pluginBuildDir.removeBuildDir();
  }
}

module.exports = ServerlessNextJsPlugin;
