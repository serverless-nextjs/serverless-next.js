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

  const target = nextConfiguration.target;
  const assetPrefix = nextConfiguration.assetPrefix;

  if (target !== "serverless") {
    throw createError(
      `Target '${target}' is invalid. Set 'serverless' as the target`
    );
  }

  if (!assetPrefix) {
    throw createError(
      "No assetPrefix configured. Set a valid assetPrefix in the form of https://s3.amazonaws.com/{your_bucket_name}"
    );
  }

  const { Bucket } = s3Urls.fromUrl(assetPrefix);

  if (!Bucket) {
    throw createError(
      `Could not parse bucket from assetPrefix: ${assetPrefix}`
    );
  }

  return {
    staticAssetsBucket: Bucket,
    nextConfiguration
  };
};
