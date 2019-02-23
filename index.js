"use strict";

const path = require("path");
const walkDir = require("klaw");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("./lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("./lib/addS3BucketToResources");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {};

    this.beforeCreateDeploymentArtifacts = this.beforeCreateDeploymentArtifacts.bind(
      this
    );

    this.afterAwsDeployUploadArtifacts = this.afterAwsDeployUploadArtifacts.bind(
      this
    );

    this.hooks = {
      "before:package:createDeploymentArtifacts": this
        .beforeCreateDeploymentArtifacts,
      "after:aws:deploy:uploadArtifacts": this.afterAwsDeployUploadArtifacts
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
    return addS3BucketToResources(
      this.serverless.service.provider.compiledCloudFormationTemplate
    ).then(cfWithBucket => {
      this.serverless.service.provider.compiledCloudFormationTemplate = cfWithBucket;

      const functionHandlerPathMap = this.getNextFunctionHandlerPathsMap();

      return createHttpServerLambdaCompatHandlers(functionHandlerPathMap).then(
        compatHandlerPathMap => {
          return swapOriginalAndCompatHandlers(
            functionHandlerPathMap,
            compatHandlerPathMap
          );
        }
      );
    });
  }

  afterAwsDeployUploadArtifacts() {
    walkDir(path.join(this.getConfigValue("nextBuildDir"), "static"));
    return Promise.resolve("OK");
  }
}

module.exports = ServerlessNextJsPlugin;
