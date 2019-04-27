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
  const nextConfigDir = this.getPluginConfigValue("nextConfigDir");
  const staticDir = this.getPluginConfigValue("staticDir");

  let { staticAssetsBucket } = parseNextConfiguration(nextConfigDir);

  const bucketNameFromConfig = this.getPluginConfigValue("assetsBucketName");

  if (bucketNameFromConfig) {
    // bucket name provided via user config takes precendence
    // over parsed value from assetPrefix
    staticAssetsBucket = bucketNameFromConfig;
  }

  if (!staticAssetsBucket) {
    if (staticDir) {
      return Promise.reject(
        new Error(
          "staticDir requires a bucket. See https://github.com/danielcondemarin/serverless-nextjs-plugin#hosting-static-assets"
        )
      );
    }

    return Promise.resolve();
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
