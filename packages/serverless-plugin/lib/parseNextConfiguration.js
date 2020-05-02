let nextLoadConfig;
let PHASE_PRODUCTION_BUILD;
try {
  nextLoadConfig = require("next-server/dist/server/config").default;
  PHASE_PRODUCTION_BUILD = require("next-server/dist/lib/constants")
    .PHASE_PRODUCTION_BUILD;
} catch (e) {
  // https://github.com/danielcondemarin/serverless-next.js/issues/157
  // Some files were moved in the dist/ directory in next.js 9.0.6
  // check the new location if the old location failed.
  nextLoadConfig = require("next/dist/next-server/server/config").default;
  PHASE_PRODUCTION_BUILD = require("next/dist/next-server/lib/constants")
    .PHASE_PRODUCTION_BUILD;
}

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
