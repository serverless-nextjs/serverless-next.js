const withCSS = require("@zeit/next-css");

const config = {
  target: "serverless",
  assetPrefix: "https://s3.amazonaws.com/BUCKET_NAME"
};

if (process.env.NODE_ENV === "development") {
  delete config.assetPrefix;
}

module.exports = withCSS(config);
