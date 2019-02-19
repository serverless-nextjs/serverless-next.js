"use strict";

const path = require("path");
const injectHttpServerLambdaCompatLayer = require("./lib/injectHttpServerLambdaCompatLayer");

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {};

    this.hooks = {
      "before:package:createDeploymentArtifacts": this
        .beforeCreateDeploymentArtifacts
    };
  }

  beforeCreateDeploymentArtifacts() {
    const functions = this.serverless.service.functions;

    const jsHandlerPaths = Object.keys(functions)
      .filter(f => functions[f].handler.includes(".next/serverless/pages"))
      .map(f => {
        const handlerPath = functions[f].handler;

        const dirname = path.dirname(handlerPath);
        const handlerFileName = path.basename(handlerPath, ".render");

        return `${path.join(dirname, handlerFileName)}.js`;
      });

    return injectHttpServerLambdaCompatLayer(jsHandlerPaths);
  }
}

module.exports = ServerlessPlugin;
