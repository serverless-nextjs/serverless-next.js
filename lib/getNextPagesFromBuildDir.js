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

  return readdirAsync(pagesDir).then(pageFiles => {
    const pageNameAndPathMap = pageFiles.reduce((acc, f) => {
      const pageName = path.basename(f, ".js");
      const isUnderscorePageHandler = pageName.startsWith("_");

      if (isUnderscorePageHandler === false) {
        const pageNameWithSuffix = pageName + "Page";
        acc[pageNameWithSuffix] = f;
      }

      return acc;
    }, {});

    logPages(pageNameAndPathMap);

    return pageNameAndPathMap;
  });
};
