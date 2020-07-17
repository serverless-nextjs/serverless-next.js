const withCSS = require("@zeit/next-css");

const config = {
  target: "serverless",
  assetPrefix: "https://s3.amazonaws.com/foobarbazban"
};

module.exports = withCSS(config);
