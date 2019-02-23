"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const walkDir = require("klaw");
const merge = require("lodash.merge");
const yaml = require("js-yaml");
const cfSchema = require("./lib/cfSchema");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("./lib/swapOriginalAndCompatHandlers");

const readFileAsync = promisify(fs.readFile);

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
    const filename = path.resolve(__dirname, "resources.yml");
    return readFileAsync(filename, "utf-8").then(resourcesContent => {
      const resources = yaml.safeLoad(resourcesContent, {
        filename,
        schema: cfSchema
      });

      merge(
        this.serverless.service.provider.compiledCloudFormationTemplate,
        resources
      );

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
