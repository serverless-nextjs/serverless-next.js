const serverlessPluginFactory = require("../utils/test/serverlessPluginFactory");
const parsedNextConfigurationFactory = require("../utils/test/parsedNextConfigurationFactory");
const addS3BucketToResources = require("../lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("../lib/uploadStaticAssetsToS3");
const displayStackOutput = require("../lib/displayStackOutput");
const parseNextConfiguration = require("../lib/parseNextConfiguration");
const build = require("../lib/build");
const NextPage = require("../classes/NextPage");

jest.mock("js-yaml");
jest.mock("../lib/build");
jest.mock("../lib/parseNextConfiguration");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/uploadStaticAssetsToS3");
jest.mock("../lib/displayStackOutput");

describe("ServerlessNextJsPlugin", () => {
  beforeEach(() => {
    addS3BucketToResources.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("#constructor", () => {
    it("should hook to before:package:initialize", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks["before:package:initialize"]).toEqual(
        plugin.buildNextPages
      );
    });

    it("should hook to before:package:createDeploymentArtifacts", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks["before:package:createDeploymentArtifacts"]).toEqual(
        plugin.addStaticAssetsBucket
      );
    });

    it("should hook to after:aws:deploy:deploy:uploadArtifacts", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks["after:aws:deploy:deploy:uploadArtifacts"]).toEqual(
        plugin.uploadStaticAssets
      );
    });

    it("should hook to after:aws:info:displayStackOutputs", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks["after:aws:info:displayStackOutputs"]).toEqual(
        plugin.printStackOutput
      );
    });
  });

  describe("buildNextPages", () => {
    it("should call build with nextConfigDir", () => {
      expect.assertions(1);

      build.mockResolvedValueOnce([]);

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: "/path/to/next"
            }
          }
        }
      });

      return plugin.buildNextPages().then(() => {
        expect(build).toBeCalledWith("/path/to/next");
      });
    });

    it("should set the next functions in serverless", () => {
      expect.assertions(1);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";
      const aboutPagePath = "/path/to/next/build/serverless/pages/about.js";

      build.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const plugin = serverlessPluginFactory();

      return plugin.buildNextPages().then(() => {
        expect(Object.keys(plugin.serverless.service.functions)).toEqual([
          "homePage",
          "aboutPage"
        ]);
      });
    });

    it("should call service.setFunctionNames", () => {
      expect.assertions(1);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";
      const aboutPagePath = "/path/to/next/build/serverless/pages/about.js";

      build.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const setFunctionNamesMock = jest.fn();

      const plugin = serverlessPluginFactory({
        service: {
          setFunctionNames: setFunctionNamesMock
        }
      });

      return plugin.buildNextPages().then(() => {
        expect(setFunctionNamesMock).toBeCalled();
      });
    });

    it("should NOT set next functions already declared in serverless", () => {
      expect.assertions(3);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";

      build.mockResolvedValueOnce([new NextPage(homePagePath)]);

      const plugin = serverlessPluginFactory({
        service: {
          functions: {
            homePage: {
              handler: "/path/to/next/build/serverless/pages/home.render",
              foo: "bar"
            }
          }
        }
      });

      return plugin.buildNextPages().then(() => {
        const functions = plugin.serverless.service.functions;
        expect(Object.keys(functions)).toHaveLength(1);
        expect(functions.homePage).toBeDefined();
        expect(functions.homePage.foo).toEqual("bar");
      });
    });
  });

  describe("#addStaticAssetsBucket", () => {
    beforeEach(() => {
      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory()
      );
    });

    it("should update coreCloudFormationTemplate and compiledCloudFormation template with static assets bucket", () => {
      expect.assertions(5);

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

      return plugin.addStaticAssetsBucket().then(() => {
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
  });

  describe("#uploadStaticAssets", () => {
    beforeEach(() => {
      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory({
          distDir: "build"
        })
      );
    });

    it("should call uploadStaticAssetsToS3 with bucketName and next static dir", () => {
      uploadStaticAssetsToS3.mockResolvedValueOnce("Assets Uploaded");

      const plugin = serverlessPluginFactory();

      return plugin.uploadStaticAssets().then(() => {
        expect(uploadStaticAssetsToS3).toBeCalledWith({
          staticAssetsPath: "build/static",
          bucketName: "my-bucket",
          providerRequest: expect.any(Function)
        });
      });
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

      const plugin = serverlessPluginFactory({
        pluginManager: {
          getPlugins
        }
      });

      plugin.printStackOutput();

      expect(displayStackOutput).toBeCalledWith(awsInfo);
    });
  });
});
