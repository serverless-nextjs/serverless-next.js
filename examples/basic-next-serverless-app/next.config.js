const withCSS = require("@zeit/next-css");
module.exports = withCSS({
  target: "serverless",
  distDir: "build",
  assetPrefix: "https://s3.amazonaws.com/my-serverless-app-assets"
});
