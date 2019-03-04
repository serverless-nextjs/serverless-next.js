const nextBuild = require("next/dist/build").default;
const path = require("path");
const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const copyNextPages = require("./copyNextPages");
const PluginBuildDir = require("../classes/PluginBuildDir");
const getNextPagesFromBuildDir = require("./getNextPagesFromBuildDir");

const overrideTargetIfNotServerless = nextConfiguration => {
  if (nextConfiguration.target !== "serverless") {
    logger.log(
      `Target "${
        nextConfiguration.target
      }" found! Overriding it with serverless`
    );
    nextConfiguration.target = "serverless";
  }
};

module.exports = async nextConfigDir => {
  logger.log("Started building next app ...");

  const pluginBuildDir = new PluginBuildDir(nextConfigDir);

  const { nextConfiguration } = await parseNextConfiguration(nextConfigDir);

  overrideTargetIfNotServerless(nextConfiguration);

  await nextBuild(path.resolve(nextConfigDir), nextConfiguration);
  await copyNextPages(
    path.join(nextConfigDir, nextConfiguration.distDir),
    pluginBuildDir
  );

  return getNextPagesFromBuildDir(pluginBuildDir.buildDir);
};
