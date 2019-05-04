const fse = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");
const merge = require("lodash.merge");
const cfSchema = require("./cfSchema");
const getAssetsBucketName = require("./getAssetsBucketName");
const logger = require("../utils/logger");

const addCustomStackResources = async function() {
  const bucketName = getAssetsBucketName.call(this);

  if (bucketName === null) {
    return Promise.resolve();
  }

  const filename = path.resolve(__dirname, "../resources.yml");
  const resourcesContent = await fse.readFile(filename, "utf-8");

  const resources = yaml.safeLoad(resourcesContent, {
    filename,
    schema: cfSchema
  });

  logger.log(`Found bucket "${bucketName}"`);

  resources.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;
  merge(this.serverless.service.provider.coreCloudFormationTemplate, resources);

  this.serverless.service.resources = resources;
};

module.exports = addCustomStackResources;
