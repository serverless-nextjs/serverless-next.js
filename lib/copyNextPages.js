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

  const copyFilePromises = pageFiles.map(pf => {
    const src = path.join(pagesBuildDir, pf);
    const dest = path.join(pluginBuildDirObj.buildDir, pf);

    return copyFileAsync(src, dest);
  });

  return Promise.all(copyFilePromises);
};
