const nextLoadConfig = require("next-server/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next-server/dist/lib/constants");
const s3Urls = require("@mapbox/s3urls");
const createError = require("../utils/createPromiseError");

module.exports = nextConfigDir => {
  if (typeof nextConfigDir !== "string") {
    const err = createError("Provide a valid next.config file path");
    throw err;
  }

  const nextConfiguration = nextLoadConfig(
    PHASE_PRODUCTION_BUILD,
    nextConfigDir
  );

  const target = nextConfiguration.target;
  const assetPrefix = nextConfiguration.assetPrefix;

  if (target !== "serverless") {
    const err = createError(
      `Target '${target}' is invalid. Set 'serverless' as the target`
    );
    throw err;
  }

  if (!assetPrefix) {
    const err = createError(
      "No assetPrefix configured. Set a valid assetPrefix in the form of https://s3.amazonaws.com/{your_bucket_name}"
    );
    throw err;
  }

  const { Bucket } = s3Urls.fromUrl(assetPrefix);

  if (!Bucket) {
    const err = createError(
      `Could not parse bucket from assetPrefix: ${assetPrefix}`
    );
    throw err;
  }

  return {
    staticAssetsBucket: Bucket,
    nextBuildDir: nextConfiguration.distDir
  };
};
