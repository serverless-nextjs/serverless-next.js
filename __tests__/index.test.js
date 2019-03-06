const serverlessPluginFactory = require("../utils/test/serverlessPluginFactory");
const parsedNextConfigurationFactory = require("../utils/test/parsedNextConfigurationFactory");
const addS3BucketToResources = require("../lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("../lib/uploadStaticAssetsToS3");
const displayStackOutput = require("../lib/displayStackOutput");
const parseNextConfiguration = require("../lib/parseNextConfiguration");
const build = require("../lib/build");
const NextPage = require("../classes/NextPage");
const logger = require("../utils/logger");
const PluginBuildDir = require("../classes/PluginBuildDir");

jest.mock("js-yaml");
jest.mock("../lib/build");
jest.mock("../lib/parseNextConfiguration");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/uploadStaticAssetsToS3");
jest.mock("../lib/displayStackOutput");
jest.mock("../utils/logger");

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
    describe("packaging plugin build directory", () => {
      const nextConfigDir = "/path/to/next-app";
      let plugin;

      beforeEach(() => {
        build.mockResolvedValueOnce([]);

        plugin = serverlessPluginFactory({
          service: {
            package: {
              include: []
            },
            custom: {
              "serverless-nextjs": {
                nextConfigDir
              }
            }
          }
        });
      });

      it("should include plugin build directory for packaging", () => {
        expect.assertions(1);

        return plugin.buildNextPages().then(() => {
          expect(plugin.serverless.service.package.include).toContain(
            `${nextConfigDir}/sls-next-build/*`
          );
        });
      });

      it("should include plugin build directory for packaging when package include isn't defined", () => {
        expect.assertions(1);

        plugin.serverless.service.package.include = undefined;

        return plugin.buildNextPages().then(() => {
          expect(plugin.serverless.service.package.include).toContain(
            `${nextConfigDir}/sls-next-build/*`
          );
        });
      });
    });

    it("should call build with pluginBuildDir", () => {
      expect.assertions(1);

      build.mockResolvedValueOnce([]);
      const nextConfigDir = "/path/to/next";

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: nextConfigDir
            }
          }
        }
      });

      return plugin.buildNextPages().then(() => {
        expect(build).toBeCalledWith(new PluginBuildDir(nextConfigDir));
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
    const mockCFWithBucket = {
      Resources: {
        NextStaticAssetsBucket: {}
      }
    };

    beforeEach(() => {
      addS3BucketToResources.mockResolvedValue(mockCFWithBucket);
    });

    it("should not call addS3BucketToResources if a staticAssetsBucket is not available", () => {
      expect.assertions(1);
      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory({}, null)
      );
      const plugin = serverlessPluginFactory();

      return plugin.addStaticAssetsBucket().then(() => {
        expect(addS3BucketToResources).not.toBeCalled();
      });
    });

    it("should log when a bucket is going to be provisioned", () => {
      expect.assertions(1);

      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory()
      );

      const plugin = serverlessPluginFactory();

      return plugin.addStaticAssetsBucket().then(() => {
        expect(logger.log).toBeCalledWith(
          expect.stringContaining(`Found bucket "my-bucket"`)
        );
      });
    });

    it("should update coreCloudFormationTemplate with static assets bucket", () => {
      expect.assertions(2);

      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory()
      );

      const initialCoreCF = {
        Resources: { bar: "baz" }
      };

      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            coreCloudFormationTemplate: initialCoreCF
          }
        }
      });

      return plugin.addStaticAssetsBucket().then(() => {
        const {
          coreCloudFormationTemplate
        } = plugin.serverless.service.provider;

        expect(addS3BucketToResources).toBeCalledWith(
          "my-bucket",
          initialCoreCF
        );
        expect(coreCloudFormationTemplate).toEqual(mockCFWithBucket);
      });
    });

    it("should update compiledCloudFormation with static assets bucket", () => {
      expect.assertions(2);

      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory()
      );

      const initialCompiledCF = {
        Resources: { foo: "bar" }
      };

      const plugin = serverlessPluginFactory({
        service: {
          provider: {
            compiledCloudFormationTemplate: initialCompiledCF
          }
        }
      });

      return plugin.addStaticAssetsBucket().then(() => {
        const {
          compiledCloudFormationTemplate
        } = plugin.serverless.service.provider;
        expect(addS3BucketToResources).toBeCalledWith(
          "my-bucket",
          initialCompiledCF
        );
        expect(compiledCloudFormationTemplate).toEqual(mockCFWithBucket);
      });
    });
  });

  describe("#uploadStaticAssets", () => {
    it("should NOT call uploadStaticAssetsToS3 when there isn't a bucket available", () => {
      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory({}, null)
      );

      const plugin = serverlessPluginFactory();

      return plugin.uploadStaticAssets().then(() => {
        expect(uploadStaticAssetsToS3).not.toBeCalled();
      });
    });

    it("should call uploadStaticAssetsToS3 with bucketName and next static dir", () => {
      parseNextConfiguration.mockReturnValueOnce(
        parsedNextConfigurationFactory({
          distDir: "build"
        })
      );

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
