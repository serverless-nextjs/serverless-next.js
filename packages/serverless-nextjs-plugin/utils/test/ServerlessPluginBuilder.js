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
        return {
          request: () => {},
          getRegion: () => "us-east-1",
          getStage: () => "test"
        };
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
    const plugin = new ServerlessNextJsPlugin(this.serverless, {});
    plugin.initializeVariables();
    return plugin;
  }
}

module.exports = ServerlessPluginBuilder;
