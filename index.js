"use strict";

const path = require("path");
const nextBuild = require("next/dist/build").default;
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("./lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("./lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("./lib/uploadStaticAssetsToS3");
const displayStackOutput = require("./lib/displayStackOutput");
const parseNextConfiguration = require("./lib/parseNextConfiguration");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.provider = this.serverless.getProvider("aws");
    this.consoleLog = this.serverless.cli.consoleLog.bind(this.serverless.cli);
    this.providerRequest = this.provider.request.bind(this.provider);

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

  getPluginConfigValue(param) {
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

  getConfiguration() {
    return parseNextConfiguration(this.getPluginConfigValue("nextConfigDir"));
  }

  getNextFunctionHandlerPathsMap(nextBuildDir) {
    const functions = this.serverless.service.functions;

    const functionJsHandlerMap = Object.keys(functions)
      .filter(f =>
        functions[f].handler.includes(
          path.join(nextBuildDir, "serverless/pages")
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
    const nextConfigDir = this.getPluginConfigValue("nextConfigDir");

    return nextBuild(path.resolve(nextConfigDir)).then(() => {
      return this.getConfiguration().then(
        ({ staticAssetsBucket, nextBuildDir }) => {
          return this.getCFTemplatesWithBucket(staticAssetsBucket).then(
            ([compiledCfWithBucket, coreCfWithBucket]) => {
              this.serverless.service.provider.compiledCloudFormationTemplate = compiledCfWithBucket;
              this.serverless.service.provider.coreCloudFormationTemplate = coreCfWithBucket;

              const functionHandlerPathMap = this.getNextFunctionHandlerPathsMap(
                nextBuildDir
              );
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
      );
    });
  }

  afterUploadArtifacts() {
    return this.getConfiguration().then(
      ({ nextBuildDir, staticAssetsBucket }) => {
        return uploadStaticAssetsToS3({
          staticAssetsPath: path.join(nextBuildDir, "static"),
          providerRequest: this.providerRequest,
          bucketName: staticAssetsBucket,
          consoleLog: this.consoleLog
        });
      }
    );
  }

  afterDisplayStackOutputs() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayStackOutput({
      awsInfo,
      consoleLog: this.consoleLog
    });
  }
}

module.exports = ServerlessNextJsPlugin;
