const fs = require("fs");
const yaml = require("js-yaml");
const addS3BucketToResources = require("../addS3BucketToResources");

jest.mock("fs");
jest.mock("js-yaml");

describe("addS3BucketToResources", () => {
  it("should merge S3 bucket resources for next static assets", () => {
    expect.assertions(5);

    fs.readFile.mockImplementation((path, encoding, cb) =>
      cb(null, "Resources:...")
    );
    const s3Resources = {
      Resources: {
        NextStaticAssetsS3Bucket: {
          Properties: {
            BucketName: "TO_BE_REPLACED"
          }
        }
      }
    };
    yaml.safeLoad.mockReturnValueOnce(s3Resources);

    const bucketName = "my-bucket";
    const baseCloudFormation = {
      Resources: {}
    };

    return addS3BucketToResources(bucketName, baseCloudFormation).then(cf => {
      expect(fs.readFile).toBeCalledWith(
        expect.stringContaining("resources.yml"),
        "utf-8",
        expect.any(Function)
      );

      expect(yaml.safeLoad).toBeCalledWith("Resources:...", {
        filename: expect.stringContaining("resources.yml")
      });
      expect(cf.Resources).toHaveProperty("NextStaticAssetsS3Bucket");
      const bucketResource = cf.Resources.NextStaticAssetsS3Bucket;
      expect(bucketResource).toHaveProperty("Properties");
      expect(bucketResource.Properties.BucketName).toEqual(bucketName);
    });
  });
});
