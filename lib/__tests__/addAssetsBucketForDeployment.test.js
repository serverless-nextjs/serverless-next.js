const addS3BucketToResources = require("../addS3BucketToResources");
const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const addAssetsBucketForDeployment = require("../addAssetsBucketForDeployment");
const logger = require("../../utils/logger");

jest.mock("../addS3BucketToResources");
jest.mock("../parseNextConfiguration");
jest.mock("../../utils/logger");

describe("addAssetsBucketForDeployment", () => {
  const mockCFWithBucket = {
    Resources: {
      NextStaticAssetsBucket: {}
    }
  };

  let plugin;

  beforeEach(() => {
    plugin = new ServerlessPluginBuilder().build();
    addS3BucketToResources.mockResolvedValue(mockCFWithBucket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should not call addS3BucketToResources if a staticAssetsBucket is not available", () => {
    expect.assertions(1);
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({}, null)
    );

    return addAssetsBucketForDeployment.call(plugin).then(() => {
      expect(addS3BucketToResources).not.toBeCalled();
    });
  });

  it("should call parseNextConfiguration with nextConfigDir", () => {
    expect.assertions(1);

    const nextConfigDir = "./";

    plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        nextConfigDir
      })
      .build();

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    return addAssetsBucketForDeployment.call(plugin).then(() => {
      expect(parseNextConfiguration).toBeCalledWith(nextConfigDir);
    });
  });

  it("should log when a bucket is going to be provisioned from parsed assetPrefix", () => {
    expect.assertions(1);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    return addAssetsBucketForDeployment.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Found bucket "my-bucket"`)
      );
    });
  });

  it("should log when a bucket is going to be provisioned from plugin config", () => {
    expect.assertions(1);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        assetsBucketName: "my-assets"
      })
      .build();

    return addAssetsBucketForDeployment.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Found bucket "my-assets"`)
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

    plugin = new ServerlessPluginBuilder()
      .withService({
        provider: {
          coreCloudFormationTemplate: initialCoreCF
        }
      })
      .build();

    return addAssetsBucketForDeployment.call(plugin).then(() => {
      const { coreCloudFormationTemplate } = plugin.serverless.service.provider;

      expect(addS3BucketToResources).toBeCalledWith("my-bucket", initialCoreCF);
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

    const plugin = new ServerlessPluginBuilder()
      .withService({
        provider: {
          compiledCloudFormationTemplate: initialCompiledCF
        }
      })
      .build();

    return addAssetsBucketForDeployment.call(plugin).then(() => {
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
