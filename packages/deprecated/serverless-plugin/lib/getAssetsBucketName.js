const parseNextConfiguration = require("./parseNextConfiguration");

module.exports = function () {
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
      throw new Error(
        "staticDir requires a bucket. See https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/deprecated/serverless-plugin#hosting-static-assets"
      );
    }

    return null;
  }

  return staticAssetsBucket;
};
