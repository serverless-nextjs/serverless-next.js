const path = require("path");
const fs = require("fs-extra");

class PluginBuildDir {
  constructor(nextConfigDir) {
    this.nextConfigDir = nextConfigDir;
  }

  get buildDir() {
    return path.join(this.nextConfigDir, "sls-next-build");
  }

  setupBuildDir() {
    return fs.emptyDir(this.buildDir);
  }
}

module.exports = PluginBuildDir;
