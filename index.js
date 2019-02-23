"use strict";

const path = require("path");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("./lib/swapOriginalAndCompatHandlers");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {};

    this.beforeCreateDeploymentArtifacts = this.beforeCreateDeploymentArtifacts.bind(
      this
    );

    this.hooks = {
      "before:package:createDeploymentArtifacts": this
        .beforeCreateDeploymentArtifacts
    };
  }

  getNextFunctionHandlerPathsMap() {
    const functions = this.serverless.service.functions;

    const functionJsHandlerMap = Object.keys(functions)
      .filter(f => functions[f].handler.includes(".next/serverless/pages"))
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
    const functionHandlerPathMap = this.getNextFunctionHandlerPathsMap();
    return createHttpServerLambdaCompatHandlers(functionHandlerPathMap).then(
      compatHandlerPathMap => {
        return swapOriginalAndCompatHandlers(
          functionHandlerPathMap,
          compatHandlerPathMap
        );
      }
    );
  }
}

module.exports = ServerlessNextJsPlugin;
