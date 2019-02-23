const walkDir = require("klaw");
const ServerlessNextJsPlugin = require("../index");
const createHttpServerLambdaCompatHandlers = require("../lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("../lib/swapOriginalAndCompatHandlers");

jest.mock("klaw");
jest.mock("../lib/swapOriginalAndCompatHandlers");
jest.mock("../lib/createHttpServerLambdaCompatHandlers");

describe("ServerlessNextJsPlugin", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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

    it("should hook to before:package:createDeploymentArtifacts", () => {
      const plugin = new ServerlessNextJsPlugin({}, {});
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "after:aws:deploy:uploadArtifacts":
            plugin.afterAwsDeployUploadArtifacts
        })
      );
    });
  });

  describe("#beforeCreateDeploymentArtifacts", () => {
    it("should call createHttpServerLambdaCompatHandlers with nextjs page handlers", () => {
      expect.assertions(1);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([
        ".next/serverless/pages/home.compat.render",
        ".next/serverless/pages/home.about.render"
      ]);

      const plugin = new ServerlessNextJsPlugin({
        pluginManager: {
          run: () => {}
        },
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(createHttpServerLambdaCompatHandlers).toBeCalledWith({
          "home-page": ".next/serverless/pages/home.js",
          "about-page": ".next/serverless/pages/about.js"
        });
      });
    });

    it("should call createHttpServerLambdaCompatHandlers without non nextjs page handlers", () => {
      expect.assertions(1);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);

      const plugin = new ServerlessNextJsPlugin({
        pluginManager: {
          run: () => {}
        },
        service: {
          functions: {
            foo: { handler: "path/to/foo.bar" },
            baz: { handler: "path/to/baz.bar" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(createHttpServerLambdaCompatHandlers).toBeCalledWith({});
      });
    });

    it("should call createHttpServerLambdaCompatHandlers with non nextjs page handlers using the next custom build dir provided", () => {
      expect.assertions(1);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);

      const plugin = new ServerlessNextJsPlugin({
        pluginManager: {
          run: () => {}
        },
        service: {
          custom: {
            "serverless-nextjs": {
              nextBuildDir: "build"
            }
          },
          functions: {
            foo: { handler: "build/serverless/pages/foo.render" },
            baz: { handler: "path/to/baz.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(createHttpServerLambdaCompatHandlers).toBeCalledWith({
          foo: "build/serverless/pages/foo.js"
        });
      });
    });

    it("should call swapOriginalAndCompatHandlers", () => {
      expect.assertions(1);

      const pluginManagerRunMock = jest.fn();

      const compatHandlerPathMap = {
        "home-page": ".next/serverless/pages/home.compat.js",
        "about-page": ".next/serverless/pages/about.compat.js"
      };
      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce(
        Promise.resolve(compatHandlerPathMap)
      );

      const plugin = new ServerlessNextJsPlugin({
        pluginManager: {
          run: pluginManagerRunMock
        },
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(result => {
        expect(swapOriginalAndCompatHandlers).toBeCalledWith(
          {
            "home-page": ".next/serverless/pages/home.js",
            "about-page": ".next/serverless/pages/about.js"
          },
          compatHandlerPathMap
        );
      });
    });

    it("should return the result of swapOriginalAndCompatHandlers", () => {
      expect.assertions(1);

      const pluginManagerRunMock = jest.fn();

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);
      swapOriginalAndCompatHandlers.mockResolvedValueOnce(
        Promise.resolve("OK")
      );

      const plugin = new ServerlessNextJsPlugin({
        pluginManager: {
          run: pluginManagerRunMock
        },
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(result => {
        expect(result).toEqual("OK");
      });
    });
  });

  describe("#afterAwsDeployUploadArtifacts", () => {
    it("should get a list of all static files to upload", () => {
      const plugin = new ServerlessNextJsPlugin({}, {});

      return plugin.afterAwsDeployUploadArtifacts().then(() => {
        expect(walkDir).toBeCalledWith(".next/static");
      });
    });

    it("should get a list of all static files to upload using the custom next build dir provided", () => {
      const plugin = new ServerlessNextJsPlugin(
        {
          service: {
            custom: {
              "serverless-nextjs": {
                nextBuildDir: "build"
              }
            }
          }
        },
        {}
      );

      return plugin.afterAwsDeployUploadArtifacts().then(() => {
        expect(walkDir).toBeCalledWith("build/static");
      });
    });
  });
});
