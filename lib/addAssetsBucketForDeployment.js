const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const addS3BucketToResources = require("./addS3BucketToResources");

const getCFTemplatesWithBucket = async function(bucketName) {
  return Promise.all([
    addS3BucketToResources(
      bucketName,
      this.serverless.service.provider.compiledCloudFormationTemplate
    ),
    addS3BucketToResources(
      bucketName,
      this.serverless.service.provider.coreCloudFormationTemplate
    )
  ]);
};

module.exports = async function() {
  let { staticAssetsBucket } = parseNextConfiguration(
    this.getPluginConfigValue("nextConfigDir")
  );

  const bucketNameFromConfig = this.getPluginConfigValue("assetsBucketName");

  if (bucketNameFromConfig) {
    // bucket name provided via user config takes precendence
    // over parsed value from assetPrefix
    staticAssetsBucket = bucketNameFromConfig;
  }

  if (!staticAssetsBucket) {
    return;
  }

  logger.log(`Found bucket "${staticAssetsBucket}"`);

  const [
    compiledCfWithBucket,
    coreCfWithBucket
  ] = await getCFTemplatesWithBucket.call(this, staticAssetsBucket);

  this.serverless.service.provider.compiledCloudFormationTemplate = compiledCfWithBucket;
  this.serverless.service.provider.coreCloudFormationTemplate = coreCfWithBucket;

  return Promise.resolve();
};
