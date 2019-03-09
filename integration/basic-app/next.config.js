const config = {};

if (process.env.ASSET_PREFIX) {
  config.assetPrefix = process.env.ASSET_PREFIX;
}

module.exports = config;
