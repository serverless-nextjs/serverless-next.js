const nextLoadConfig = require("next-server/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next-server/dist/lib/constants");
const s3Urls = require("@mapbox/s3urls");
const createPromiseError = require("../utils/createPromiseError");

module.exports = nextConfigDir => {
  if (typeof nextConfigDir !== "string") {
    return createPromiseError("Provide a valid next.config file path");
  }

  const nextConfiguration = nextLoadConfig(
    PHASE_PRODUCTION_BUILD,
    nextConfigDir
  );

  const target = nextConfiguration.target;
  const assetPrefix = nextConfiguration.assetPrefix;

  if (target !== "serverless") {
    return createPromiseError(
      `Target '${target}' is invalid. Set 'serverless' as the target`
    );
  }

  if (!assetPrefix) {
    return createPromiseError(
      "No assetPrefix configured. Set a valid assetPrefix in the form of https://s3.amazonaws.com/{your_bucket_name}"
    );
  }

  const { Bucket } = s3Urls.fromUrl(assetPrefix);

  if (!Bucket) {
    return createPromiseError(
      `Could not parse bucket from assetPrefix: ${assetPrefix}`
    );
  }

  return Promise.resolve({
    staticAssetsBucket: Bucket,
    nextBuildDir: nextConfiguration.distDir
  });
};
