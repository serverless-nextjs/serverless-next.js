const withCSS = require("@zeit/next-css");

const config = {
  target: "serverless",
  assetPrefix: "https://s3.amazonaws.com/BUCKET_NAME"
};

module.exports = withCSS(config);
