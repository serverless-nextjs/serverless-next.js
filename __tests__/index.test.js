const walkDir = require("klaw");
const fs = require("fs");
const merge = require("lodash.merge");
const ServerlessNextJsPlugin = require("../index");
const createHttpServerLambdaCompatHandlers = require("../lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("../lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("../lib/addS3BucketToResources");

jest.mock("fs");
jest.mock("js-yaml");
jest.mock("klaw");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/swapOriginalAndCompatHandlers");
jest.mock("../lib/createHttpServerLambdaCompatHandlers");

const serverlessPluginFactory = (options = {}) => {
  const ctorOptions = {
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
        "serverless-nextjs": {}
      }
    }
  };
  merge(ctorOptions, options);
  return new ServerlessNextJsPlugin(ctorOptions, {});
};

describe("ServerlessNextJsPlugin", () => {
  beforeEach(() => {
    addS3BucketToResources.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("#constructor", () => {
    it("should hook to before:package:createDeploymentArtifacts", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "before:package:createDeploymentArtifacts":
            plugin.beforeCreateDeploymentArtifacts
        })
      );
    });

    it("should hook to before:package:createDeploymentArtifacts", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "after:deploy:deploy": plugin.afterDeploy
        })
      );
    });
  });

  describe("#beforeCreateDeploymentArtifacts", () => {
    it("should call addS3BucketToResources to get CloudFormation template with S3Bucket", () => {
      expect.assertions(2);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);
      addS3BucketToResources.mockResolvedValueOnce({
        Resources: { foo: "bar" }
      });

      const bucketName = "My-Bucket";
      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              staticAssetsBucket: bucketName
            }
          },
          provider: {
            compiledCloudFormationTemplate: {
              Resources: {}
            }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(addS3BucketToResources).toBeCalledWith(bucketName, {
          Resources: {}
        });
        expect(
          plugin.serverless.service.provider.compiledCloudFormationTemplate
        ).toEqual({
          Resources: {
            foo: "bar"
          }
        });
      });
    });

    it("should call createHttpServerLambdaCompatHandlers with nextjs page handlers", () => {
      expect.assertions(1);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([
        ".next/serverless/pages/home.compat.render",
        ".next/serverless/pages/home.about.render"
      ]);

      const plugin = serverlessPluginFactory({
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

      const plugin = serverlessPluginFactory({
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

      const plugin = serverlessPluginFactory({
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

      const compatHandlerPathMap = {
        "home-page": ".next/serverless/pages/home.compat.js",
        "about-page": ".next/serverless/pages/about.compat.js"
      };
      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce(
        Promise.resolve(compatHandlerPathMap)
      );

      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            compiledCloudFormationTemplate: {}
          },
          functions: {
            "home-page": { handler: ".next/serverless/pages/home.render" },
            "about-page": { handler: ".next/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
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

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);
      swapOriginalAndCompatHandlers.mockResolvedValueOnce(
        Promise.resolve("OK")
      );

      const plugin = serverlessPluginFactory({
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

  describe("#afterDeploy", () => {
    let walkDirStreamMock;

    beforeEach(() => {
      walkDirStreamMock = {
        on: (event, cb) => {
          if (event === "data") {
            cb({ path: "/users/foo/prj/.next/static/chunks/foo.js" });
          } else if (event === "end") {
            cb();
          }

          return walkDirStreamMock;
        }
      };

      fs.lstatSync.mockReturnValue({ isDirectory: () => false });
      walkDir.mockImplementation(() => walkDirStreamMock);
    });

    it("should get a list of all static files to upload", () => {
      expect.assertions(1);

      const plugin = serverlessPluginFactory();

      return plugin.afterDeploy().then(() => {
        expect(walkDir).toBeCalledWith(".next/static");
      });
    });

    it("should get a list of all static files to upload using the custom next build dir provided", () => {
      expect.assertions(1);

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextBuildDir: "build"
            }
          }
        }
      });

      return plugin.afterDeploy().then(() => {
        expect(walkDir).toBeCalledWith("build/static");
      });
    });

    it("should upload to S3 the next static assets", () => {
      expect.assertions(1);

      fs.createReadStream.mockReturnValueOnce("FakeStream");
      walkDir.mockImplementationOnce(() => walkDirStreamMock);

      const providerRequest = jest.fn();
      const bucketName = "my-bucket";
      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              staticAssetsBucket: bucketName
            }
          }
        },
        getProvider: () => {
          return { request: providerRequest };
        }
      });

      return plugin.afterDeploy().then(() => {
        expect(providerRequest).toBeCalledWith(
          "S3",
          "upload",
          expect.objectContaining({
            Bucket: bucketName
          })
        );
      });
    });

    it("should not try to upload directories to S3 bucket", () => {
      expect.assertions(1);

      const walkDirStreamMock = {
        on: (event, cb) => {
          if (event === "data") {
            cb({ path: "/users/foo/prj/.next/static/chunks" });
          } else if (event === "end") {
            cb();
          }

          return walkDirStreamMock;
        }
      };

      walkDir.mockClear();
      fs.lstatSync.mockReturnValue({ isDirectory: () => true });
      walkDir.mockImplementation(() => walkDirStreamMock);

      const providerRequest = jest.fn();
      const plugin = serverlessPluginFactory({
        getProvider: () => {
          return { request: providerRequest };
        }
      });

      return plugin.afterDeploy().then(() => {
        expect(providerRequest).not.toBeCalled();
      });
    });
  });
});
