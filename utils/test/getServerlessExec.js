const path = require("path");

const serverlessExec = path.join(
  __dirname,
  "..",
  "..",
  "node_modules/.bin/serverless"
);

module.exports = serverlessExec;
