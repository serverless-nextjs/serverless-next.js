const path = require("path");
const uploadStaticAssetsToS3 = require("./upload");

module.exports = function() {
  let { nextConfiguration, staticAssetsBucket } = this.configuration;

  const bucketNameFromConfig = this.getPluginConfigValue("assetsBucketName");

  if (bucketNameFromConfig) {
    staticAssetsBucket = bucketNameFromConfig;
  }

  if (!staticAssetsBucket) {
    return Promise.resolve();
  }

  return uploadStaticAssetsToS3({
    staticAssetsPath: path.join(
      this.nextConfigDir,
      nextConfiguration.distDir,
      "static"
    ),
    providerRequest: this.providerRequest,
    bucketName: staticAssetsBucket
  });
};
