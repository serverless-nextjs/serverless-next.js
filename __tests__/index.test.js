const nextBuild = require("next/dist/build").default;
const serverlessPluginFactory = require("../test-utils/serverlessPluginFactory");
const createHttpServerLambdaCompatHandlers = require("../lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("../lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("../lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("../lib/uploadStaticAssetsToS3");
const displayStackOutput = require("../lib/displayStackOutput");
const parseNextConfiguration = require("../lib/parseNextConfiguration");

jest.mock("next/dist/build");
jest.mock("js-yaml");
jest.mock("../lib/parseNextConfiguration");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/swapOriginalAndCompatHandlers");
jest.mock("../lib/createHttpServerLambdaCompatHandlers");
jest.mock("../lib/uploadStaticAssetsToS3");
jest.mock("../lib/displayStackOutput");

describe("ServerlessNextJsPlugin", () => {
  beforeEach(() => {
    nextBuild.mockResolvedValue({});
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

    it("should hook to after:aws:deploy:deploy:uploadArtifacts", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "after:aws:deploy:deploy:uploadArtifacts": plugin.afterUploadArtifacts
        })
      );
    });

    it("should hook to after:aws:info:displayStackOutputs", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "after:aws:info:displayStackOutputs": plugin.afterDisplayStackOutputs
        })
      );
    });
  });

  describe("#beforeCreateDeploymentArtifacts", () => {
    beforeEach(() => {
      parseNextConfiguration.mockResolvedValueOnce({
        staticAssetsBucket: "my-bucket",
        nextBuildDir: "build"
      });
    });

    it("should call nextBuild using the dir passed via options", () => {
      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: "/path/to/next"
            }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(nextBuild).toBeCalledWith("/path/to/next");
      });
    });

    it("should update coreCloudFormationTemplate and compiledCloudFormation template with static assets bucket", () => {
      expect.assertions(5);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);
      const cfWithBucket = {
        Resources: {
          NextStaticAssetsBucket: {}
        }
      };

      addS3BucketToResources.mockResolvedValue(cfWithBucket);

      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            compiledCloudFormationTemplate: {
              Resources: { foo: "bar" }
            },
            coreCloudFormationTemplate: {
              Resources: { bar: "baz" }
            }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        const {
          compiledCloudFormationTemplate,
          coreCloudFormationTemplate
        } = plugin.serverless.service.provider;

        expect(addS3BucketToResources).toBeCalledTimes(2);
        expect(addS3BucketToResources).toBeCalledWith("my-bucket", {
          Resources: {
            foo: "bar"
          }
        });
        expect(addS3BucketToResources).toBeCalledWith("my-bucket", {
          Resources: {
            bar: "baz"
          }
        });
        expect(compiledCloudFormationTemplate).toEqual(cfWithBucket);
        expect(coreCloudFormationTemplate).toEqual(cfWithBucket);
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

    it("should call createHttpServerLambdaCompatHandlers with page handlers using the next build dir from configuration", () => {
      expect.assertions(1);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);

      const plugin = serverlessPluginFactory({
        service: {
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
        "home-page": "build/serverless/pages/home.compat.js",
        "about-page": "build/serverless/pages/about.compat.js"
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
            "home-page": { handler: "build/serverless/pages/home.render" },
            "about-page": { handler: "build/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(swapOriginalAndCompatHandlers).toBeCalledWith(
          {
            "home-page": "build/serverless/pages/home.js",
            "about-page": "build/serverless/pages/about.js"
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
            "home-page": { handler: "build/serverless/pages/home.render" },
            "about-page": { handler: "build/serverless/pages/about.render" }
          }
        }
      });

      return plugin.beforeCreateDeploymentArtifacts().then(result => {
        expect(result).toEqual("OK");
      });
    });
  });

  describe("#afterUploadArtifacts", () => {
    beforeEach(() => {
      parseNextConfiguration.mockResolvedValueOnce({
        nextBuildDir: "build",
        staticAssetsBucket: "my-bucket"
      });
    });

    it("should call uploadStaticAssetsToS3 with bucketName and next static dir", () => {
      uploadStaticAssetsToS3.mockResolvedValueOnce("Assets Uploaded");

      const plugin = serverlessPluginFactory();

      return plugin.afterUploadArtifacts().then(() => {
        expect(uploadStaticAssetsToS3).toBeCalledWith({
          staticAssetsPath: "build/static",
          bucketName: "my-bucket",
          providerRequest: expect.any(Function),
          consoleLog: expect.any(Function)
        });
      });
    });
  });

  describe("#afterDisplayStackOutputs", () => {
    it("should call displayStackOutput with awsInfo", () => {
      const consoleLog = () => {};
      const awsInfo = {
        constructor: {
          name: "AwsInfo"
        }
      };
      const getPlugins = jest.fn().mockReturnValueOnce([awsInfo]);

      const plugin = serverlessPluginFactory({
        cli: {
          consoleLog
        },
        pluginManager: {
          getPlugins
        }
      });

      plugin.afterDisplayStackOutputs();

      expect(displayStackOutput).toBeCalledWith({
        awsInfo,
        consoleLog: expect.any(Function)
      });
    });
  });
});
