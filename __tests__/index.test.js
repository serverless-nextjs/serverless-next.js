const nextBuild = require("next/dist/build").default;
const serverlessPluginFactory = require("../utils/test/serverlessPluginFactory");
const copyNextPages = require("../lib/copyNextPages");
const rewritePageHandlers = require("../lib/rewritePageHandlers");
const addS3BucketToResources = require("../lib/addS3BucketToResources");
const uploadStaticAssetsToS3 = require("../lib/uploadStaticAssetsToS3");
const displayStackOutput = require("../lib/displayStackOutput");
const parseNextConfiguration = require("../lib/parseNextConfiguration");
const getNextPagesFromBuildDir = require("../lib/getNextPagesFromBuildDir");
const NextPage = require("../classes/NextPage");

jest.mock("next/dist/build");
jest.mock("js-yaml");
jest.mock("../lib/copyNextPages");
jest.mock("../lib/getNextPagesFromBuildDir");
jest.mock("../lib/parseNextConfiguration");
jest.mock("../lib/addS3BucketToResources");
jest.mock("../lib/rewritePageHandlers");
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
    it("should hook to before:package:initialize", () => {
      const plugin = serverlessPluginFactory();
      expect(plugin.hooks).toEqual(
        expect.objectContaining({
          "before:package:initialize": plugin.beforePackageInitialize
        })
      );
    });

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

  describe("beforePackageInitialize", () => {
    it("should call nextBuild with nextConfigDir", () => {
      expect.assertions(1);

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([]);
      parseNextConfiguration.mockReturnValue({
        nextBuildDir: ".next"
      });

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: "/path/to/next"
            }
          }
        }
      });

      return plugin.beforePackageInitialize().then(() => {
        expect(nextBuild).toBeCalledWith("/path/to/next");
      });
    });

    it("should call copyNextPages after next finished building", () => {
      expect.assertions(1);

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([]);
      parseNextConfiguration.mockReturnValue({
        nextBuildDir: ".next"
      });

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: "/path/to/nextApp"
            }
          }
        }
      });

      return plugin.beforePackageInitialize().then(() => {
        expect(copyNextPages).toBeCalledWith(
          "/path/to/nextApp/.next",
          plugin.pluginBuildDir
        );
      });
    });

    it("should call getNextPagesFromBuildDir with plugin build directory", () => {
      expect.assertions(1);

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([]);

      const plugin = serverlessPluginFactory({
        service: {
          custom: {
            "serverless-nextjs": {
              nextConfigDir: "/path/to/next/build"
            }
          }
        }
      });

      return plugin.beforePackageInitialize().then(() => {
        expect(getNextPagesFromBuildDir).toBeCalledWith(
          plugin.pluginBuildDir.buildDir
        );
      });
    });

    it("should set the next functions in serverless", () => {
      expect.assertions(1);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";
      const aboutPagePath = "/path/to/next/build/serverless/pages/about.js";

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const plugin = serverlessPluginFactory();

      return plugin.beforePackageInitialize().then(() => {
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

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([
        new NextPage(homePagePath),
        new NextPage(aboutPagePath)
      ]);

      const setFunctionNamesMock = jest.fn();

      const plugin = serverlessPluginFactory({
        service: {
          setFunctionNames: setFunctionNamesMock
        }
      });

      return plugin.beforePackageInitialize().then(() => {
        expect(setFunctionNamesMock).toBeCalled();
      });
    });

    it("should NOT set next functions already declared in serverless", () => {
      expect.assertions(3);

      const homePagePath = "/path/to/next/build/serverless/pages/home.js";

      copyNextPages.mockResolvedValueOnce();
      getNextPagesFromBuildDir.mockResolvedValueOnce([
        new NextPage(homePagePath)
      ]);

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

      return plugin.beforePackageInitialize().then(() => {
        const functions = plugin.serverless.service.functions;
        expect(Object.keys(functions)).toHaveLength(1);
        expect(functions.homePage).toBeDefined();
        expect(functions.homePage.foo).toEqual("bar");
      });
    });
  });

  describe("#beforeCreateDeploymentArtifacts", () => {
    beforeEach(() => {
      parseNextConfiguration.mockReturnValueOnce({
        staticAssetsBucket: "my-bucket",
        nextBuildDir: "build"
      });
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

    it("should call rewritePageHandlers with next pages", () => {
      expect.assertions(1);

      const pagesDir = "build/serverless/pages";
      const nextPages = [
        new NextPage(`${pagesDir}/foo.js`),
        new NextPage(`${pagesDir}/baz.js`)
      ];

      const plugin = serverlessPluginFactory();

      plugin.nextPages = nextPages;

      return plugin.beforeCreateDeploymentArtifacts().then(() => {
        expect(rewritePageHandlers).toBeCalledWith(nextPages);
      });
    });
  });

  describe("#afterUploadArtifacts", () => {
    beforeEach(() => {
      parseNextConfiguration.mockReturnValueOnce({
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
          providerRequest: expect.any(Function)
        });
      });
    });
  });

  describe("#afterDisplayStackOutputs", () => {
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

      plugin.afterDisplayStackOutputs();

      expect(displayStackOutput).toBeCalledWith(awsInfo);
    });
  });
});
