"use strict";

const path = require("path");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");

class ServerlessPlugin {
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

  beforeCreateDeploymentArtifacts() {
    const functions = this.serverless.service.functions;

    const jsHandlerPaths = Object.keys(functions)
      .filter(f => functions[f].handler.includes(".next/serverless/pages"))
      .reduce((acc, f) => {
        const handlerPath = functions[f].handler;

        const dirname = path.dirname(handlerPath);
        const handlerFileName = path.basename(handlerPath, ".render");

        acc[f] = `${path.join(dirname, handlerFileName)}.js`;
        return acc;
      }, {});

    return createHttpServerLambdaCompatHandlers(jsHandlerPaths);
  }
}

module.exports = ServerlessPlugin;
