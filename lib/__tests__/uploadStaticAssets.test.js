const path = require("path");
const uploadStaticAssets = require("../uploadStaticAssets");
const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const uploadDirToS3Factory = require("../../utils/s3/upload");

jest.mock("../../utils/s3/upload");
jest.mock("../parseNextConfiguration");

describe("uploadStaticAssets", () => {
  let uploadDirToS3;

  beforeEach(() => {
    uploadDirToS3 = jest.fn().mockResolvedValue();
    uploadDirToS3Factory.mockReturnValue(uploadDirToS3);
  });

  it("should NOT upload build assets when there isn't a bucket available", () => {
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({}, null)
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).not.toBeCalled();
    });
  });

  it("should upload next build assets", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledTimes(1);
      expect(uploadDirToS3).toBeCalledWith(
        path.join("/path/to/next", distDir, "static"),
        {
          bucket: "my-bucket",
          prefix: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("should upload next build assets using bucketName from plugin config", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    const plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        assetsBucketName: "custom-bucket"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(
        path.join("/path/to/next", distDir, "static"),
        {
          bucket: "custom-bucket",
          prefix: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("should upload staticDir", () => {
    const staticDir = "/path/to/assets";

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        staticDir: "/path/to/assets"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(staticDir, {
        bucket: "my-bucket",
        prefix: "assets"
      });
    });
  });

  it("should not upload build assets", () => {
    const staticDir = "/path/to/assets";

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        uploadBuildAssets: false,
        staticDir: "/path/to/assets"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledTimes(1);
      expect(uploadDirToS3).toBeCalledWith(staticDir, {
        bucket: "my-bucket",
        prefix: "assets"
      });
    });
  });
});
