const nextBuild = require("next/dist/build").default;
const path = require("path");
const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const copyNextPages = require("./copyNextPages");
const PluginBuildDir = require("../classes/PluginBuildDir");
const getNextPagesFromBuildDir = require("./getNextPagesFromBuildDir");

module.exports = nextConfigDir => {
  logger.log("Started building next app ...");

  return parseNextConfiguration(nextConfigDir).then(config => {
    const nextConfig = config.nextConfiguration;

    if (nextConfig.target !== "serverless") {
      logger.log(
        `Target "${nextConfig.target}" found! Overriding it with serverless`
      );
      nextConfig.target = "serverless";
    }

    const pluginBuildDir = new PluginBuildDir(nextConfigDir);

    return nextBuild(path.resolve(nextConfigDir), nextConfig).then(() =>
      copyNextPages(
        path.join(nextConfigDir, nextConfig.distDir),
        pluginBuildDir
      ).then(() => getNextPagesFromBuildDir(pluginBuildDir.buildDir))
    );
  });
};
