const fse = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

module.exports = async (
  nextBuildDir,
  pluginBuildDirObj,
  customHandler = null
) => {
  logger.log("Copying next pages to tmp build folder");

  const pagesBuildDir = path.join(nextBuildDir, "serverless/pages");
  await pluginBuildDirObj.setupBuildDir();

  return Promise.all([
    fse.copy(pagesBuildDir, pluginBuildDirObj.buildDir),
    fse.copy(
      path.join(__dirname, "./compatLayer.js"),
      path.join(
        pluginBuildDirObj.buildDir,
        "./node_modules/serverless-nextjs-plugin/lib/compatLayer.js"
      )
    ),
    fse.copy(
      path.join(__dirname, "../aws-lambda-compat.js"),
      path.join(
        pluginBuildDirObj.buildDir,
        "./node_modules/serverless-nextjs-plugin/aws-lambda-compat.js"
      )
    )
  ]);
};
