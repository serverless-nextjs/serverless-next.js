const fs = require("fs");
const yaml = require("js-yaml");
const addS3BucketToResources = require("../addS3BucketToResources");

jest.mock("fs");
jest.mock("js-yaml");

describe("addS3BucketToResources", () => {
  it("should merge S3 bucket resources for next static assets", () => {
    expect.assertions(4);

    fs.readFile.mockImplementation((path, encoding, cb) =>
      cb(null, "Resources:...")
    );
    yaml.safeLoad.mockReturnValueOnce({ Resources: { foo: "bar" } });

    const baseCloudFormation = {
      Resources: {}
    };

    return addS3BucketToResources(baseCloudFormation).then(cf => {
      expect(fs.readFile).toBeCalledWith(
        expect.stringContaining("resources.yml"),
        "utf-8",
        expect.any(Function)
      );

      expect(yaml.safeLoad).toBeCalledWith("Resources:...", {
        filename: expect.stringContaining("resources.yml")
      });
      expect(cf.Resources).toHaveProperty("foo");
      expect(cf.Resources.foo).toEqual("bar");
    });
  });
});
