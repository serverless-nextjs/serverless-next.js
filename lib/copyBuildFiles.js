const fse = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

module.exports = async (nextBuildDir, pluginBuildDirObj) => {
  logger.log("Copying next pages to tmp build folder");

  const pagesBuildDir = path.join(nextBuildDir, "serverless/pages");

  await pluginBuildDirObj.setupBuildDir();
  await fse.copy(pagesBuildDir, pluginBuildDirObj.buildDir);
  await fse.copy(
    path.join(__dirname, "./compatLayer.js"),
    path.join(pluginBuildDirObj.buildDir, "./compatLayer.js")
  );
};
