const nextLoadConfig = require("next-server/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next-server/dist/lib/constants");
const s3Urls = require("@mapbox/s3urls");
const createError = require("../utils/createError");

module.exports = nextConfigDir => {
  if (typeof nextConfigDir !== "string") {
    throw createError("Provide a valid next.config file path");
  }

  const nextConfiguration = nextLoadConfig(
    PHASE_PRODUCTION_BUILD,
    nextConfigDir
  );

  const assetPrefix = nextConfiguration.assetPrefix;
  let staticAssetsBucket = null;

  if (assetPrefix) {
    const { Bucket } = s3Urls.fromUrl(assetPrefix);

    if (Bucket) {
      staticAssetsBucket = Bucket;
    }
  }

  return {
    staticAssetsBucket,
    nextConfiguration
  };
};
