const withCSS = require("@zeit/next-css");
module.exports = withCSS({
  assetPrefix: "https://s3.amazonaws.com/BUCKET_NAME"
});
