const serverlessPluginFactory = require("../test-utils/serverlessPluginFactory");
const createHttpServerLambdaCompatHandlers = require("../lib/createHttpServerLambdaCompatHandlers");
const swapOriginalAndCompatHandlers = require("../lib/swapOriginalAndCompatHandlers");
const addS3BucketToResources = require("../lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("../lib/uploadStaticAssetsToS3");

jest.mock("js-yaml");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/swapOriginalAndCompatHandlers");
jest.mock("../lib/createHttpServerLambdaCompatHandlers");
jest.mock("../lib/uploadStaticAssetsToS3");

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
    it("should update coreCloudFormationTemplate and compiledCloudFormation template with static assets bucket", () => {
      expect.assertions(5);

      createHttpServerLambdaCompatHandlers.mockResolvedValueOnce([]);
      const cfWithBucket = {
        Resources: {
          NextStaticAssetsBucket: {}
        }
      };
      addS3BucketToResources.mockResolvedValue(cfWithBucket);

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
        expect(addS3BucketToResources).toBeCalledWith(bucketName, {
          Resources: {
            foo: "bar"
          }
        });
        expect(addS3BucketToResources).toBeCalledWith(bucketName, {
          Resources: {
            bar: "baz"
          }
        });
        expect(compiledCloudFormationTemplate).toEqual(cfWithBucket);
        expect(coreCloudFormationTemplate).toEqual(cfWithBucket);
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

  describe("#afterUploadArtifacts", () => {
    it("should call uploadStaticAssetsToS3 with bucketName and next static dir", () => {
      uploadStaticAssetsToS3.mockResolvedValueOnce("Assets Uploaded");

      const plugin = serverlessPluginFactory({
        provider: {
          request: () => {}
        },
        service: {
          custom: {
            "serverless-nextjs": {
              nextBuildDir: "build",
              staticAssetsBucket: "my-bucket"
            }
          }
        }
      });

      return plugin.afterUploadArtifacts().then(() => {
        expect(uploadStaticAssetsToS3).toBeCalledWith({
          staticAssetsPath: "build/static",
          bucketName: "my-bucket",
          providerRequest: expect.any(Function)
        });
      });
    });
  });

  describe("#afterDisplayStackOutputs", () => {
    it("should print S3 Bucket Secure URL", () => {
      const consoleLog = jest.fn();
      const getPlugins = jest.fn().mockReturnValueOnce([
        {
          constructor: {
            name: "AwsInfo"
          },
          gatheredData: {
            outputs: [
              {
                OutputKey: "foo"
              },
              {
                OutputKey: "NextStaticAssetsS3BucketSecureURL",
                OutputValue: "https://my-bucket.s3.amazonaws.com"
              },
              {
                OutputKey: "NextStaticAssetsS3BucketWebsiteURL",
                OutputValue:
                  "http://my-sls-next-app.s3-website-us-east-1.amazonaws.com"
              }
            ]
          }
        }
      ]);

      const plugin = serverlessPluginFactory({
        cli: {
          consoleLog
        },
        pluginManager: {
          getPlugins
        }
      });

      plugin.afterDisplayStackOutputs();

      expect(consoleLog).toBeCalledWith(
        expect.stringContaining("Nextjs static assets bucket details:")
      );
      expect(consoleLog).toBeCalledWith(
        expect.stringContaining("https://my-bucket.s3.amazonaws.com")
      );
      expect(consoleLog).toBeCalledWith(
        expect.stringContaining(
          "http://my-sls-next-app.s3-website-us-east-1.amazonaws.com"
        )
      );
    });
  });
});
