const path = require("path");
const fs = require("fs-extra");
const logger = require("../utils/logger");

class PluginBuildDir {
  constructor(nextConfigDir) {
    this.nextConfigDir = nextConfigDir;
  }

  get buildDir() {
    return path.join(this.nextConfigDir, PluginBuildDir.BUILD_DIR_NAME);
  }

  get posixBuildDir() {
    return path.posix.join(this.nextConfigDir, PluginBuildDir.BUILD_DIR_NAME);
  }

  static get BUILD_DIR_NAME() {
    return "sls-next-build";
  }

  setupBuildDir() {
    return fs.emptyDir(this.buildDir);
  }

  removeBuildDir() {
    logger.log("Cleaning up tmp build folder ...");
    return fs.remove(this.buildDir);
  }
}

module.exports = PluginBuildDir;
