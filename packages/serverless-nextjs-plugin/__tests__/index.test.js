const ServerlessPluginBuilder = require("../utils/test/ServerlessPluginBuilder");
const displayStackOutput = require("../lib/displayStackOutput");

jest.mock("../lib/displayStackOutput");

describe("ServerlessNextJsPlugin", () => {
  let pluginBuilder;

  beforeEach(() => {
    pluginBuilder = new ServerlessPluginBuilder();
  });

  describe("#constructor", () => {
    let plugin;

    beforeAll(() => {
      plugin = new ServerlessPluginBuilder().build();
    });

    it.each`
      hook                                                          | method
      ${"before:offline:start"}                                     | ${"build"}
      ${"before:package:initialize"}                                | ${"build"}
      ${"before:deploy:function:initialize"}                        | ${"build"}
      ${"after:aws:deploy:deploy:checkForChanges"}                  | ${"checkForChanges"}
      ${"after:aws:deploy:deploy:uploadArtifacts"}                  | ${"uploadStaticAssets"}
      ${"after:aws:info:displayStackOutputs"}                       | ${"printStackOutput"}
      ${"after:package:createDeploymentArtifacts"}                  | ${"removePluginBuildDir"}
      ${"before:aws:package:finalize:mergeCustomProviderResources"} | ${"addCustomStackResources"}
    `("should hook to $hook with method $method", ({ hook, method }) => {
      expect(plugin[method]).toBeDefined();
      expect(plugin.hooks[hook]).toEqual(plugin[method]);
    });
  });

  describe("#printStackOutput", () => {
    it("should call displayStackOutput with awsInfo", () => {
      const awsInfo = {
        constructor: {
          name: "AwsInfo"
        }
      };
      const getPlugins = jest.fn().mockReturnValueOnce([awsInfo]);

      const plugin = new ServerlessPluginBuilder()
        .withPluginManager({
          getPlugins
        })
        .build();

      plugin.printStackOutput();

      expect(displayStackOutput).toBeCalledWith(awsInfo);
    });
  });

  describe("#removePluginBuildDir", () => {
    it("should call pluginBuildDir.removeBuildDir", () => {
      const plugin = new ServerlessPluginBuilder().build();
      const mockRemoveBuildDir = jest.fn().mockResolvedValueOnce();
      plugin.pluginBuildDir.removeBuildDir = mockRemoveBuildDir;

      return plugin.removePluginBuildDir().then(() => {
        expect(mockRemoveBuildDir).toBeCalled();
      });
    });
  });

  describe("#getPluginConfigValue", () => {
    it("uses default values when config key not provided", () => {
      const plugin = pluginBuilder
        .withPluginConfig({
          routes: undefined,
          uploadBuildAssets: undefined
        })
        .build();

      expect(plugin.getPluginConfigValue("routes")).toEqual([]);
      expect(plugin.getPluginConfigValue("uploadBuildAssets")).toEqual(true);
    });
  });
});
