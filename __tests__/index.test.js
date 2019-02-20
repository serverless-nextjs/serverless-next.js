const ServerlessNextJsPlugin = require("../index");
const injectHttpServerLambdaCompatLayer = require("../lib/injectHttpServerLambdaCompatLayer");

jest.mock("../lib/injectHttpServerLambdaCompatLayer");

describe("ServerlessNextJsPlugin", () => {
  describe("#constructor", () => {
    it("should hook to before:package:createDeploymentArtifacts", () => {
      const plugin = new ServerlessNextJsPlugin({}, {});
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "before:package:createDeploymentArtifacts":
            plugin.beforeCreateDeploymentArtifacts
        })
      );
    });
  });

  describe("#beforeCreateDeploymentArtifacts", () => {
    it("should call injectHttpServerLambdaCompatLayer with nextjs page handlers", () => {
      const plugin = new ServerlessNextJsPlugin({
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      plugin.beforeCreateDeploymentArtifacts();

      expect(injectHttpServerLambdaCompatLayer).toBeCalledWith({
        "home-page": ".next/serverless/pages/home.js",
        "about-page": ".next/serverless/pages/about.js"
      });
    });

    it("should call injectHttpServerLambdaCompatLayer without non nextjs page handlers", () => {
      const plugin = new ServerlessNextJsPlugin({
        service: {
          functions: {
            foo: { handler: "path/to/foo.bar" },
            baz: { handler: "path/to/baz.bar" }
          }
        }
      });

      plugin.beforeCreateDeploymentArtifacts();

      expect(injectHttpServerLambdaCompatLayer).toBeCalledWith({});
    });

    it("should return with injectHttpServerLambdaCompatLayer return value", () => {
      injectHttpServerLambdaCompatLayer.mockResolvedValueOnce(
        Promise.resolve("OK")
      );

      const plugin = new ServerlessNextJsPlugin({
        service: {
          functions: {
            foo: { handler: "path/to/foo.bar" },
            baz: { handler: "path/to/baz.bar" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(result => {
        expect(result).toEqual("OK");
      });
    });
  });
});
