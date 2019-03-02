const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const logger = require("../utils/logger");

const readdirAsync = promisify(fs.readdir);

const logPages = pageNameHandlerMap => {
  const logMessage =
    "Found next pages:\n" +
    Object.entries(pageNameHandlerMap)
      .map(([pageName, pagePath]) => {
        return `- ${pageName}: ${pagePath}`;
      })
      .join("\n");

  logger.log(logMessage);
};

module.exports = buildDir => {
  const serverlessPagesDir = path.join(buildDir, "serverless/pages");
  return readdirAsync(serverlessPagesDir).then(files => {
    const pageNameHandlerMap = files.reduce((acc, f) => {
      const pageName = path.basename(f, ".js");
      const pageNameWithSuffix = pageName + "Page";
      acc[pageNameWithSuffix] = f;
      return acc;
    }, {});

    logPages(pageNameHandlerMap);

    return pageNameHandlerMap;
  });
};
