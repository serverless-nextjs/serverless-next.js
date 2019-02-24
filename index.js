"use strict";

const path = require("path");
const chalk = require("chalk");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("./lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("./lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("./lib/uploadStaticAssetsToS3");
const displayStackOutput = require("./lib/displayStackOutput");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.provider = this.serverless.getProvider("aws");

    this.commands = {};

    this.beforeCreateDeploymentArtifacts = this.beforeCreateDeploymentArtifacts.bind(
      this
    );

    this.afterUploadArtifacts = this.afterUploadArtifacts.bind(this);
    this.afterDisplayStackOutputs = this.afterDisplayStackOutputs.bind(this);

    this.hooks = {
      "before:package:createDeploymentArtifacts": this
        .beforeCreateDeploymentArtifacts,
      "after:aws:deploy:deploy:uploadArtifacts": this.afterUploadArtifacts,
      "after:aws:info:displayStackOutputs": this.afterDisplayStackOutputs
    };
  }

  getConfigValue(param) {
    const defaultPluginConfig = {
      nextBuildDir: ".next"
    };

    try {
      const val = this.serverless.service.custom["serverless-nextjs"][param];
      return val !== undefined ? val : defaultPluginConfig[param];
    } catch (err) {
      return defaultPluginConfig[param];
    }
  }

  getNextFunctionHandlerPathsMap() {
    const functions = this.serverless.service.functions;

    const functionJsHandlerMap = Object.keys(functions)
      .filter(f =>
        functions[f].handler.includes(
          path.join(this.getConfigValue("nextBuildDir"), "serverless/pages")
        )
      )
      .reduce((acc, f) => {
        const handlerPath = functions[f].handler;

        const dirname = path.dirname(handlerPath);
        const handlerFileName = path.basename(handlerPath, ".render");

        acc[f] = `${path.join(dirname, handlerFileName)}.js`;
        return acc;
      }, {});

    return functionJsHandlerMap;
  }

  beforeCreateDeploymentArtifacts() {
    const bucketName = this.getConfigValue("staticAssetsBucket");

    const addBucketToCloudFormation = [
      addS3BucketToResources(
        bucketName,
        this.serverless.service.provider.compiledCloudFormationTemplate
      ),
      addS3BucketToResources(
        bucketName,
        this.serverless.service.provider.coreCloudFormationTemplate
      )
    ];

    return Promise.all(addBucketToCloudFormation).then(
      ([compiledCfWithBucket, coreCfWithBucket]) => {
        this.serverless.service.provider.compiledCloudFormationTemplate = compiledCfWithBucket;
        this.serverless.service.provider.coreCloudFormationTemplate = coreCfWithBucket;

        const functionHandlerPathMap = this.getNextFunctionHandlerPathsMap();

        return createHttpServerLambdaCompatHandlers(
          functionHandlerPathMap
        ).then(compatHandlerPathMap => {
          return swapOriginalAndCompatHandlers(
            functionHandlerPathMap,
            compatHandlerPathMap
          );
        });
      }
    );
  }

  afterUploadArtifacts() {
    return uploadStaticAssetsToS3({
      staticAssetsPath: path.join(
        this.getConfigValue("nextBuildDir"),
        "static"
      ),
      providerRequest: this.provider.request,
      bucketName: this.getConfigValue("staticAssetsBucket")
    });
  }

  afterDisplayStackOutputs() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayStackOutput({
      awsInfo,
      consoleLog: this.serverless.cli.consoleLog
    });
  }
}

module.exports = ServerlessNextJsPlugin;
