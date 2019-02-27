const merge = require("lodash.merge");
const ServerlessNextJsPlugin = require("./..");

const serverlessPluginFactory = (options = {}) => {
  const ctorOptions = {
    cli: {
      consoleLog: () => {}
    },
    getPlugins: () => {},
    getProvider: () => {
      return { request: () => {} };
    },
    pluginManager: {
      run: () => {}
    },
    service: {
      functions: {},
      provider: {
        compiledCloudFormationTemplate: {}
      },
      custom: {
        "serverless-nextjs": {
          nextConfigDir: "/path/to/next"
        }
      }
    }
  };
  merge(ctorOptions, options);
  return new ServerlessNextJsPlugin(ctorOptions, {});
};

module.exports = serverlessPluginFactory;
