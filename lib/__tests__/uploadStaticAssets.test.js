const path = require("path");
const uploadStaticAssets = require("../uploadStaticAssets");
const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const uploadStaticAssetsToS3 = require("../uploadStaticAssetsToS3");

jest.mock("../uploadStaticAssetsToS3");
jest.mock("../parseNextConfiguration");

describe("uploadStaticAssets", () => {
  it("should NOT call uploadStaticAssetsToS3 when there isn't a bucket available", () => {
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({}, null)
    );

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadStaticAssetsToS3).not.toBeCalled();
    });
  });

  it("should call uploadStaticAssetsToS3 with bucketName and next static dir", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    uploadStaticAssetsToS3.mockResolvedValueOnce("Assets Uploaded");

    const plugin = new ServerlessPluginBuilder().build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadStaticAssetsToS3).toBeCalledWith({
        staticAssetsPath: path.join("/path/to/next", distDir, "static"),
        bucketName: "my-bucket",
        providerRequest: expect.any(Function)
      });
    });
  });

  it("should call uploadStaticAssetsToS3 with bucketName from plugin config", () => {
    const distDir = "build";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({
        distDir
      })
    );

    uploadStaticAssetsToS3.mockResolvedValueOnce("Assets Uploaded");

    const plugin = new ServerlessPluginBuilder()
      .withNextCustomConfig({
        assetsBucketName: "custom-bucket"
      })
      .build();

    return uploadStaticAssets.call(plugin).then(() => {
      expect(uploadStaticAssetsToS3).toBeCalledWith({
        staticAssetsPath: path.join("/path/to/next", distDir, "static"),
        bucketName: "custom-bucket",
        providerRequest: expect.any(Function)
      });
    });
  });
});
