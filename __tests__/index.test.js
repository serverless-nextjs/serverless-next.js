const fs = require("fs");
const ServerlessNextJsPlugin = require("../index");
const createHttpServerLambdaCompatHandlers = require("../lib/createHttpServerLambdaCompatHandlers");

jest.mock("fs");
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

    it("should return the result of createHttpServerLambdaCompatHandlers", () => {
      expect.assertions(1);

      const pluginManagerRunMock = jest.fn();

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce(
        Promise.resolve([
          "next/serverless/pages/home.compat.js",
          "next/serverless/pages/about.compat.js"
        ])
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
        expect(result).toEqual([
          "next/serverless/pages/home.compat.js",
          "next/serverless/pages/about.compat.js"
        ]);
      });
    });
  });

  describe("#swapHandlers", () => {
    it("should rename next handler files and append .original to them", () => {
      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));
      const plugin = new ServerlessNextJsPlugin({
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin
        .swapHandlers({
          "home-page": ".next/serverless/pages/home.compat.js",
          "about-page": ".next/serverless/pages/about.compat.js"
        })
        .then(() => {
          expect(fs.rename).toBeCalledWith(
            ".next/serverless/pages/home.js",
            ".next/serverless/pages/home.original.js",
            expect.any(Function)
          );
          expect(fs.rename).toBeCalledWith(
            ".next/serverless/pages/about.js",
            ".next/serverless/pages/about.original.js",
            expect.any(Function)
          );
        });
    });

    it("should set compat handler files as the main handlers", () => {
      expect.assertions(2);

      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));
      const plugin = new ServerlessNextJsPlugin({
        service: {
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin
        .swapHandlers({
          "home-page": ".next/serverless/pages/home.compat.js",
          "about-page": ".next/serverless/pages/about.compat.js"
        })
        .then(() => {
          expect(fs.rename).toBeCalledWith(
            ".next/serverless/pages/home.compat.js",
            ".next/serverless/pages/home.js",
            expect.any(Function)
          );
          expect(fs.rename).toBeCalledWith(
            ".next/serverless/pages/about.compat.js",
            ".next/serverless/pages/about.js",
            expect.any(Function)
          );
        });
    });
  });
});
