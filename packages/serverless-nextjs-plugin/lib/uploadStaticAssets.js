const fs = require("fs");
const path = require("path");
const uploadDirToS3Factory = require("../utils/s3/upload");
const logger = require("../utils/logger");

module.exports = function() {
  const uploadDirToS3 = uploadDirToS3Factory(this.providerRequest);

  let { nextConfiguration, staticAssetsBucket } = this.configuration;

  const [
    bucketNameFromConfig,
    staticDir = "static",
    publicDir = "public",
    uploadBuildAssets
  ] = this.getPluginConfigValues(
    "assetsBucketName",
    "staticDir",
    "publicDir",
    "uploadBuildAssets"
  );

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
        truncate: "static",
        rootPrefix: "_next"
      }
    );
    uploadPromises.push(buildAssetsUpload);
  }

  const staticFiles = fs.readdirSync(staticDir);

  if (staticFiles) {
    logger.log(`Uploading static files to ${staticAssetsBucket}/${staticDir}`);
    const staticDirUpload = uploadDirToS3(staticDir, {
      bucket: staticAssetsBucket,
      truncate: path.basename(staticDir)
    });

    uploadPromises.push(staticDirUpload);
  }

  const publicFiles = fs.readdirSync(publicDir);

  if (publicFiles) {
    logger.log(`Uploading public files to ${staticAssetsBucket}/${publicDir}`);
    const staticDirUpload = uploadDirToS3(publicDir, {
      bucket: staticAssetsBucket,
      truncate: path.basename(publicDir)
    });

    uploadPromises.push(staticDirUpload);
  }

  return Promise.all(uploadPromises);
};
