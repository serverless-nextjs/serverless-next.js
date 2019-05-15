const path = require("path");

// .bin/serverless exists at the monorepo root
let serverlessExec = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "node_modules/.bin/serverless"
);

const isWin = process.platform === "win32";

if (isWin) {
  serverlessExec += ".cmd";
}

module.exports = path.resolve(serverlessExec);
