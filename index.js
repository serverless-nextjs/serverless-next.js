"use strict";

const path = require("path");
const nextBuild = require("next/dist/build").default;
const PluginBuildDir = require("./classes/PluginBuildDir");
const rewritePageHandlers = require("./lib/rewritePageHandlers");
const addS3BucketToResources = require("./lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("./lib/uploadStaticAssetsToS3");
const displayStackOutput = require("./lib/displayStackOutput");
const parseNextConfiguration = require("./lib/parseNextConfiguration");
const getNextPagesFromBuildDir = require("./lib/getNextPagesFromBuildDir");
const copyNextPages = require("./lib/copyNextPages");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);
    this.pluginBuildDir = new PluginBuildDir(this.nextConfigDir);

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
    return nextBuild(path.resolve(this.nextConfigDir)).then(() =>
      copyNextPages(
        path.join(this.nextConfigDir, this.configuration.nextBuildDir),
        this.pluginBuildDir
      ).then(() => this.setNextPages())
    );
  }

  setNextPages() {
    const service = this.serverless.service;

    return getNextPagesFromBuildDir(this.pluginBuildDir.buildDir).then(
      nextPages => {
        this.nextPages = nextPages;

        nextPages.forEach(page => {
          const functionName = page.functionName;
          const functionAlreadyDeclared = service.functions[functionName];

          if (!functionAlreadyDeclared) {
            service.functions[functionName] =
              page.serverlessFunction[functionName];
          }
        });

        this.serverless.service.setFunctionNames();
      }
    );
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
        return rewritePageHandlers(this.nextPages);
      }
    );
  }

  afterUploadArtifacts() {
    const { nextBuildDir, staticAssetsBucket } = this.configuration;

    return uploadStaticAssetsToS3({
      staticAssetsPath: path.join(nextBuildDir, "static"),
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
