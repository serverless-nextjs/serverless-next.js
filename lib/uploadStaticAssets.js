const path = require("path");
const uploadDirToS3Factory = require("../utils/s3/upload");

module.exports = function() {
  const uploadDirToS3 = uploadDirToS3Factory(this.providerRequest);

  let { nextConfiguration, staticAssetsBucket } = this.configuration;

  const bucketNameFromConfig = this.getPluginConfigValue("assetsBucketName");
  const staticDir = this.getPluginConfigValue("staticDir");
  const uploadBuildAssets = this.getPluginConfigValue("uploadBuildAssets");

  if (bucketNameFromConfig) {
    staticAssetsBucket = bucketNameFromConfig;
  }

  if (!staticAssetsBucket) {
    return Promise.resolve();
  }

  const uploadPromises = [];

  if (uploadBuildAssets !== false) {
    const buildAssetsUpload = uploadDirToS3(
      path.join(this.nextConfigDir, nextConfiguration.distDir, "static"),
      {
        bucket: staticAssetsBucket,
        prefix: "static",
        rootPrefix: "_next"
      }
    );
    uploadPromises.push(buildAssetsUpload);
  }

  if (staticDir) {
    const staticDirUpload = uploadDirToS3(staticDir, {
      bucket: staticAssetsBucket,
      prefix: path.basename(staticDir)
    });

    uploadPromises.push(staticDirUpload);
  }

  return Promise.all(uploadPromises);
};
