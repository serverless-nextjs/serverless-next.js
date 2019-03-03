const withCSS = require("@zeit/next-css");
module.exports = withCSS({
  target: "serverless",
  assetPrefix: "https://s3.amazonaws.com/my-sls-next-app-assets"
});
