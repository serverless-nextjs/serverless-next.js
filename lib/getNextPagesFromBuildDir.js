const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const logger = require("../utils/logger");

const readdirAsync = promisify(fs.readdir);

const logPages = pageNameAndPathMap => {
  const logMessage =
    "Found next pages:\n" +
    Object.entries(pageNameAndPathMap)
      .map(([pageName, pagePath]) => {
        return `- ${pageName}: ${pagePath}`;
      })
      .join("\n");

  logger.log(logMessage);
};

module.exports = buildDir => {
  const pagesDir = path.join(buildDir, "serverless/pages");

  return readdirAsync(pagesDir).then(pageFileNames => {
    const pageNameAndPathMap = pageFileNames.reduce((acc, fileName) => {
      const pageName = path.basename(fileName, ".js");
      const isUnderscorePage = pageName.startsWith("_");

      if (isUnderscorePage === false) {
        const pageNameWithSuffix = pageName + "Page";
        acc[pageNameWithSuffix] = path.join(pagesDir, fileName);
      }

      return acc;
    }, {});

    logPages(pageNameAndPathMap);

    return pageNameAndPathMap;
  });
};
