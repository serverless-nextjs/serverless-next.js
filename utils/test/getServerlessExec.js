const path = require("path");

let serverlessExec = path.join(
  __dirname,
  "..",
  "..",
  "node_modules/.bin/serverless"
);

const isWin = process.platform === "win32";

if (isWin) {
  serverlessExec += ".cmd";
}

module.exports = path.resolve(serverlessExec);
