const merge = require("lodash.merge");
const ServerlessNextJsPlugin = require("../..");

class ServerlessPluginBuilder {
  constructor() {
    this.serverless = {
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
        package: {
          include: []
        },
        setFunctionNames: () => {},
        functions: {},
        provider: {
          getRegion: () => "us-east-1",
          compiledCloudFormationTemplate: {}
        },
        custom: {
          "serverless-nextjs": {
            nextConfigDir: "/path/to/next"
          }
        }
      }
    };
  }

  withService(service) {
    merge(this.serverless, {
      service
    });

    return this;
  }

  withPluginManager(pluginManager) {
    merge(this.serverless, {
      pluginManager
    });

    return this;
  }

  withPluginConfig(config) {
    merge(this.serverless, {
      service: {
        custom: {
          "serverless-nextjs": config
        }
      }
    });

    return this;
  }

  build() {
    return new ServerlessNextJsPlugin(this.serverless, {});
  }
}

module.exports = ServerlessPluginBuilder;
