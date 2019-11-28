const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const { when } = require("jest-when");
const uploadStaticAssets = require("../uploadStaticAssets");
const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const uploadDirToS3Factory = require("../../utils/s3/upload");

jest.mock("fs-extra");
jest.mock("../../utils/s3/upload");
jest.mock("../parseNextConfiguration");
jest.mock("fs");

describe("uploadStaticAssets", () => {
  let uploadDirToS3;

  beforeEach(() => {
    uploadDirToS3 = jest.fn().mockResolvedValue();
    uploadDirToS3Factory.mockReturnValue(uploadDirToS3);
    fs.readFileSync.mockResolvedValue("1hCeVQzuD6WJQAxuV3hwc");
  });

  it("does NOT upload build assets when there isn't a bucket available", () => {
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({}, null)
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).not.toBeCalled();
    });
  });

  it("uploads next build assets", () => {
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
          truncate: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("uploads next build assets using bucketName from plugin config", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        assetsBucketName: "custom-bucket"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(
        path.join("/path/to/next", distDir, "static"),
        {
          bucket: "custom-bucket",
          truncate: "static",
          rootPrefix: "_next"
        }
      );
    });
  });

  it("uploads static directory", () => {
    const plugin = new ServerlessPluginBuilder().build();
    const staticDir = path.join(plugin.nextConfigDir, "static");

    when(fse.pathExists)
      .calledWith(staticDir)
      .mockResolvedValueOnce(true);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(staticDir, {
        bucket: "my-bucket",
        truncate: "static"
      });
    });
  });

  it("uploads public directory", () => {
    const plugin = new ServerlessPluginBuilder().build();
    const publicDir = path.join(plugin.nextConfigDir, "public");

    when(fse.pathExists)
      .calledWith(publicDir)
      .mockResolvedValueOnce(true);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).toBeCalledWith(publicDir, {
        bucket: "my-bucket",
        truncate: "public"
      });
    });
  });

  it("does not upload build assets", () => {
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        uploadBuildAssets: false
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadDirToS3).not.toBeCalled();
    });
  });
});
