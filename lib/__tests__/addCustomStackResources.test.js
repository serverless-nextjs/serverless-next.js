const yaml = require("js-yaml");
const fse = require("fs-extra");
const clone = require("lodash.clonedeep");
const merge = require("lodash.merge");
const addCustomStackResources = require("../addCustomStackResources");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const getAssetsBucketName = require("../getAssetsBucketName");
const logger = require("../../utils/logger");

jest.mock("../getAssetsBucketName");
jest.mock("fs-extra");
jest.mock("js-yaml");
jest.mock("../../utils/logger");

describe("addCustomStackResources", () => {
  it("adds S3 bucket from resources.yml", () => {
    expect.assertions(5);

    const bucketName = "bucket-123";
    const resourcesYmlString = "Resources:...";
    const s3Resources = {
      Resources: {
        NextStaticAssetsS3Bucket: {
          Properties: {
            BucketName: "TO_BE_REPLACED"
          }
        }
      }
    };
    const coreCfTemplate = {
      Resources: {
        foo: "bar"
      }
    };
    const s3ResourcesWithBucketName = clone(s3Resources);
    s3ResourcesWithBucketName.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

    getAssetsBucketName.mockReturnValueOnce(bucketName);
    fse.readFile.mockResolvedValueOnce(resourcesYmlString);
    yaml.safeLoad.mockReturnValueOnce(s3Resources);

    const plugin = new ServerlessPluginBuilder().build();

    plugin.serverless.service.provider.coreCloudFormationTemplate = clone(
      coreCfTemplate
    );

    return addCustomStackResources.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Found bucket "${bucketName}"`)
      );
      expect(fse.readFile).toBeCalledWith(
        expect.stringContaining("resources.yml"),
        "utf-8"
      );
      expect(yaml.safeLoad).toBeCalledWith(resourcesYmlString, {
        filename: expect.stringContaining("resources.yml")
      });
      expect(plugin.serverless.service.resources).toEqual(
        s3ResourcesWithBucketName
      );
      expect(
        plugin.serverless.service.provider.coreCloudFormationTemplate
      ).toEqual(merge(coreCfTemplate, s3ResourcesWithBucketName));
    });
  });

  it("doesn't add S3 bucket from resources.yml if there isn't one", () => {
    expect.assertions(5);

    getAssetsBucketName.mockReturnValueOnce(null);

    const plugin = new ServerlessPluginBuilder().build();

    return addCustomStackResources.call(plugin).then(() => {
      expect(logger.log).not.toBeCalled();
      expect(fse.readFile).not.toBeCalled();
      expect(yaml.safeLoad).not.toBeCalled();
      expect(plugin.serverless.service.resources).toEqual(undefined);
      expect(
        plugin.serverless.service.provider.coreCloudFormationTemplate
      ).toEqual(undefined);
    });
  });
});
