const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const uploadDirToS3Factory = require("../utils/s3/upload");

module.exports = async function() {
  let { nextConfiguration, staticAssetsBucket } = this.configuration;
  const buildId = nextConfiguration.distDir // eslint-disable-next-line prettier/prettier
    ? fs.readFileSync(path.join(this.nextConfigDir, nextConfiguration.distDir, "BUILD_ID"))
    : null;

  const uploadDirToS3 = uploadDirToS3Factory(this.providerRequest, buildId);

  const [bucketNameFromConfig, uploadBuildAssets] = this.getPluginConfigValues(
    "assetsBucketName",
    "uploadBuildAssets"
  );

  if (bucketNameFromConfig) {
    staticAssetsBucket = bucketNameFromConfig;
  }

  if (!staticAssetsBucket) {
    return Promise.resolve();
  }

  const uploadPromises = [];

  const uploadStaticOrPublicDirectory = async dirName => {
    const dir = path.join(this.nextConfigDir, dirName);
    const dirExists = await fse.pathExists(dir);

    if (dirExists) {
      const uploadPromise = uploadDirToS3(dir, {
        bucket: staticAssetsBucket,
        truncate: dirName
      });

      uploadPromises.push(uploadPromise);
    }
  };

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

  uploadStaticOrPublicDirectory("static");
  uploadStaticOrPublicDirectory("public");

  return Promise.all(uploadPromises);
};
