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
    pluginManager: {
      run: () => {}
    },
    service: {
      functions: {},
      provider: {
        request: () => {},
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
          "after:aws:deploy:uploadArtifacts":
            plugin.afterAwsDeployUploadArtifacts
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

      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            compiledCloudFormationTemplate: {
              Resources: {}
            }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(addS3BucketToResources).toBeCalledWith({ Resources: {} });
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

  describe("#afterAwsDeployUploadArtifacts", () => {
    beforeEach(() => {
      const walkDirStreamMock = {
        on: (event, cb) => {
          if (event === "data") {
            cb({ path: ".next/static/chunks/foo.js" });
          } else if (event === "end") {
            cb();
          }

          return walkDirStreamMock;
        }
      };

      walkDir.mockImplementationOnce(() => walkDirStreamMock);
    });

    it("should get a list of all static files to upload", () => {
      const plugin = serverlessPluginFactory();

      return plugin.afterAwsDeployUploadArtifacts().then(() => {
        expect(walkDir).toBeCalledWith(".next/static");
      });
    });

    it("should get a list of all static files to upload using the custom next build dir provided", () => {
      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextBuildDir: "build"
            }
          }
        }
      });

      return plugin.afterAwsDeployUploadArtifacts().then(() => {
        expect(walkDir).toBeCalledWith("build/static");
      });
    });

    it("should upload to S3 the next static assets", () => {
      fs.createReadStream.mockReturnValueOnce("FakeStream");
      walkDir.mockImplementationOnce(() => walkDirStreamMock);

      const providerRequest = jest.fn();
      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            request: providerRequest
          }
        }
      });

      return plugin.afterAwsDeployUploadArtifacts().then(() => {
        expect(providerRequest).toBeCalledWith("S3", "upload", {
          Bucket: "sls-next-app-bucket",
          Key: "static/chunks/foo.js",
          Body: "FakeStream"
        });
      });
    });
  });
});
