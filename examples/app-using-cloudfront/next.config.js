const withCSS = require("@zeit/next-css");

const config = {
  target: "serverless"
};

module.exports = withCSS(config);
