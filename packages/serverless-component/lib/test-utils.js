const fse = require("fs-extra");
const path = require("path");
const { BUILD_DIR } = require("../constants");

const cleanupFixtureDirectory = fixtureDir => () => {
  return fse.remove(path.join(fixtureDir, BUILD_DIR));
};

module.exports = {
  cleanupFixtureDirectory
};
