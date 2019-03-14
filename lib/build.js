const nextBuild = require("next/dist/build").default;
const path = require("path");
const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const copyNextPages = require("./copyNextPages");
const getNextPagesFromBuildDir = require("./getNextPagesFromBuildDir");
const rewritePageHandlers = require("./rewritePageHandlers");

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

module.exports = async (pluginBuildDir, pageConfig) => {
  logger.log("Started building next app ...");

  const nextConfigDir = pluginBuildDir.nextConfigDir;
  const { nextConfiguration } = await parseNextConfiguration(nextConfigDir);

  overrideTargetIfNotServerless(nextConfiguration);

  await nextBuild(path.resolve(nextConfigDir), nextConfiguration);
  await copyNextPages(
    path.join(nextConfigDir, nextConfiguration.distDir),
    pluginBuildDir
  );

  const nextPages = await getNextPagesFromBuildDir(
    pluginBuildDir.buildDir,
    pageConfig
  );
  await rewritePageHandlers(nextPages);

  return nextPages;
};
