const parseNextConfiguration = require("../parseNextConfiguration");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const getAssetsBucketName = require("../getAssetsBucketName");

jest.mock("../parseNextConfiguration");
jest.mock("../../utils/logger");

describe("getAssetsBucketName", () => {
  it("returns no bucket when there isn't one configured", () => {
    expect.assertions(1);

    const bucketName = null;

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({ distDir: ".next" }, bucketName)
    );

    const pluginWithoutBucket = new ServerlessPluginBuilder().build();

    const result = getAssetsBucketName.call(pluginWithoutBucket);

    expect(result).toEqual(bucketName);
  });

  it("errors if staticDir provided but no bucket", () => {
    expect.assertions(1);

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory({ staticAssetsBucket: null }, null)
    );

    const pluginWithoutBucket = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir: "./static"
      })
      .build();

    expect(() => getAssetsBucketName.call(pluginWithoutBucket)).toThrow(
      "staticDir requires a bucket. See"
    );
  });

  it("returns bucket name parsed from next config", () => {
    expect.assertions(2);

    const bucketName = "bucket-123";
    const nextConfigDir = "./customConfigDir";

    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory(
        {
          distDir: ".next"
        },
        bucketName
      )
    );

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        nextConfigDir
      })
      .build();

    const result = getAssetsBucketName.call(plugin);

    expect(parseNextConfiguration).toBeCalledWith(nextConfigDir);
    expect(result).toEqual(bucketName);
  });

  it("returns bucket from plugin config", () => {
    expect.assertions(1);

    const bucketName = "my-assets";
    parseNextConfiguration.mockReturnValueOnce(
      parsedNextConfigurationFactory()
    );

    plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        assetsBucketName: bucketName
      })
      .build();

    const result = getAssetsBucketName.call(plugin);

    expect(result).toEqual(bucketName);
  });
});
