const nextBuild = require("next/dist/build").default;
const path = require("path");
const fse = require("fs-extra");
const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const copyBuildFiles = require("./copyBuildFiles");
const getNextPagesFromBuildDir = require("./getNextPagesFromBuildDir");
const rewritePageHandlers = require("./rewritePageHandlers");
const findup = require("findup-sync");

const overrideTargetIfNotServerless = nextConfiguration => {
  const { target } = nextConfiguration;
  if (target !== "serverless") {
    logger.log(`Target "${target}" found! Overriding it with serverless`);
    nextConfiguration.target = "serverless";
  }
};

module.exports = async function() {
  const pluginBuildDir = this.pluginBuildDir;
  const nextConfigDir = pluginBuildDir.nextConfigDir;

  const [pageConfig, customHandler, routes] = this.getPluginConfigValues(
    "pageConfig",
    "customHandler",
    "routes"
  );

  logger.log("Started building next app ...");

  const servicePackage = this.serverless.service.package;
  const nodeModulesPath = path.relative(nextConfigDir, findup("node_modules"));
  servicePackage.include = servicePackage.include || [];
  servicePackage.include.push(
    path.posix.join(pluginBuildDir.posixBuildDir, "**"),
    path.posix.join(`${nodeModulesPath}/next-aws-lambda`, "**", "*.js"),
    `!${path.posix.join(
      `${nodeModulesPath}/next-aws-lambda`,
      "**",
      "*.test.js"
    )}`
  );

  const { nextConfiguration } = await parseNextConfiguration(nextConfigDir);

  overrideTargetIfNotServerless(nextConfiguration);

  await nextBuild(path.resolve(nextConfigDir), nextConfiguration);
  await copyBuildFiles(
    path.join(nextConfigDir, nextConfiguration.distDir),
    pluginBuildDir
  );

  if (customHandler) {
    await fse.copy(
      path.resolve(nextConfigDir, customHandler),
      path.join(pluginBuildDir.buildDir, customHandler)
    );
  }

  const nextPages = await getNextPagesFromBuildDir(pluginBuildDir.buildDir, {
    pageConfig,
    routes,
    additionalExcludes: customHandler
      ? [path.basename(customHandler)]
      : undefined
  });

  await rewritePageHandlers(nextPages, customHandler);

  nextPages.forEach(page => {
    const functionName = page.functionName;
    this.serverless.service.functions[functionName] =
      page.serverlessFunction[functionName];
  });

  this.serverless.service.setFunctionNames();

  return nextPages;
};
