const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const logger = require("../utils/logger");

const readdirAsync = promisify(fs.readdir);
const copyFileAsync = promisify(fs.copyFile);

module.exports = async (nextBuildDir, pluginBuildDirObj) => {
  logger.log("Copying next pages to tmp build folder");

  const pagesBuildDir = path.join(nextBuildDir, "serverless/pages");

  await pluginBuildDirObj.setupBuildDir();
  const pageFiles = await readdirAsync(pagesBuildDir);

  const buildFiles = [
    ...pageFiles.map(pf => path.join(pagesBuildDir, pf)),
    path.join(__dirname, "./compatLayer.js")
  ];

  const copyFilePromises = buildFiles.map(filePath => {
    const fileName = path.basename(filePath);
    const dest = path.join(pluginBuildDirObj.buildDir, fileName);
    return copyFileAsync(filePath, dest);
  });

  return Promise.all(copyFilePromises);
};
