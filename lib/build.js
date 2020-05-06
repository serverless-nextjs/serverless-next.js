const nextBuild = require("next/dist/build").default;
const path = require("path");
const fse = require("fs-extra");
const parseNextConfiguration = require("./parseNextConfiguration");
const logger = require("../utils/logger");
const copyBuildFiles = require("./copyBuildFiles");
const getNextPagesFromBuildDir = require("./getNextPagesFromBuildDir");
const rewritePageHandlers = require("./rewritePageHandlers");

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
  const nextAwsLambdaPath = path.relative(
    nextConfigDir,
    path.dirname(require.resolve("next-aws-lambda"))
  );
  servicePackage.include = servicePackage.include || [];
  servicePackage.include.push(
    path.posix.join(pluginBuildDir.posixBuildDir, "**"),
    path.posix.join(nextAwsLambdaPath, "**", "*.js"),
    `!${path.posix.join(nextAwsLambdaPath, "**", "*.test.js")}`
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

  const usedSpace = (this.options && this.options.stage || '  ').length;
  let funcName = generateFunctionName(1, usedSpace);

  nextPages.forEach((page) => {
    const functionName = page.functionName;
    console.log(funcName(usedSpace, functionName).length)
    this.serverless.service.functions[funcName(usedSpace, functionName)] = page.serverlessFunction[functionName];
  });

  this.serverless.service.setFunctionNames();

  return nextPages;
};

function generateFunctionName(count, usedSpace) {
  return (usedSpace, functionName) => {
    const calculatedSpace = 3 + usedSpace;
    const exceeded = functionName.length + calculatedSpace > 63;

    return exceeded
      ? `${functionName.slice(0, 62 - calculatedSpace)}${count++}`
      : functionName;
  };
}