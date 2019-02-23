"use strict";

const path = require("path");
const { rename } = require("fs");
const { promisify } = require("util");
const createHttpServerLambdaCompatHandlers = require("./lib/createHttpServerLambdaCompatHandlers");

const renameAsync = promisify(rename);

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {};

    this.beforeCreateDeploymentArtifacts = this.beforeCreateDeploymentArtifacts.bind(
      this
    );

    this.swapHandlers = this.swapHandlers.bind(this);

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
    return createHttpServerLambdaCompatHandlers(functionHandlerPathMap);
  }

  swapHandlers(compatHandlerPathMap) {
    const functionHandlerPathMap = this.getNextFunctionHandlerPathsMap();

    const promises = Object.entries(compatHandlerPathMap).map(
      ([f, compatHandlerPath]) => {
        const originalHandlerPath = functionHandlerPathMap[f];
        const dirname = path.dirname(originalHandlerPath);
        const basename = path.basename(originalHandlerPath, ".js");
        const originalRenamed = path.join(dirname, `${basename}.original.js`);

        // .next/serverless/page.js -> .next/serverless/page.original.js
        return renameAsync(originalHandlerPath, originalRenamed).then(() => {
          // .next/serverless/page.compat.js -> .next/serverless/page.js
          return renameAsync(compatHandlerPath, originalHandlerPath);
        });
      }
    );

    return Promise.all(promises);
  }
}

module.exports = ServerlessNextJsPlugin;
