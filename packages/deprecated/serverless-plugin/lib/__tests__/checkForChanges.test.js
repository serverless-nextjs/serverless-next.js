const checkForChanges = require("../checkForChanges");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const getAssetsBucketName = require("../getAssetsBucketName");

jest.mock("../getAssetsBucketName");

describe("checkForChanges", () => {
  it("errors when assets bucket doesn't exist", () => {
    expect.assertions(3);

    const bucketName = "my-bucket";
    getAssetsBucketName.mockReturnValueOnce(bucketName);

    const plugin = new ServerlessPluginBuilder().build();

    plugin.provider.request = jest
      .fn()
      .mockRejectedValueOnce(new Error("The specified bucket does not exist"));

    return checkForChanges.call(plugin).catch((err) => {
      expect(plugin.provider.request).toBeCalledWith("S3", "listObjectsV2", {
        Bucket: bucketName,
        MaxKeys: 1
      });
      expect(getAssetsBucketName).toBeCalled();
      expect(err.message).toEqual(
        expect.stringContaining(
          `The assets bucket "${bucketName}" does not exist.`
        )
      );
    });
  });

  it("errors when assets bucket exists but for some reason can't read from it", () => {
    expect.assertions(1);

    getAssetsBucketName.mockReturnValueOnce("my-bucket");

    const plugin = new ServerlessPluginBuilder().build();

    plugin.provider.request = jest
      .fn()
      .mockRejectedValueOnce(new Error("Blew up"));

    return checkForChanges.call(plugin).catch((err) => {
      expect(err.message).toEqual(`Blew up`);
    });
  });
});
