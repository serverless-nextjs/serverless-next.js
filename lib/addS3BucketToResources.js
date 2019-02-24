const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const yaml = require("js-yaml");
const clone = require("lodash.clonedeep");
const merge = require("lodash.merge");
const cfSchema = require("../data/cfSchema");

const readFileAsync = promisify(fs.readFile);

const addS3BucketToResources = (bucketName, baseCf) => {
  const cf = clone(baseCf);

  const filename = path.resolve(__dirname, "../resources.yml");
  return readFileAsync(filename, "utf-8").then(resourcesContent => {
    const resources = yaml.safeLoad(resourcesContent, {
      filename,
      schema: cfSchema
    });

    merge(cf, resources);

    cf.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

    return cf;
  });
};

module.exports = addS3BucketToResources;
