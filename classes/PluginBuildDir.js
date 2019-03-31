const path = require("path");
const fs = require("fs-extra");
const logger = require("../utils/logger");

const BUILD_DIR_NAME = "sls-next-build";

class PluginBuildDir {
  constructor(nextConfigDir) {
    this.nextConfigDir = nextConfigDir;
  }

  get buildDir() {
    return path.join(this.nextConfigDir, BUILD_DIR_NAME);
  }

  get posixBuildDir() {
    return path.posix.join(this.nextConfigDir, BUILD_DIR_NAME);
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
