const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const logger = require("../utils/logger");
const NextPage = require("../classes/NextPage");

const readdirAsync = promisify(fs.readdir);

const logPages = nextPages => {
  const pageNames = nextPages.map(p => p.pageName);
  logger.log(`Found next pages: ${pageNames.join(" | ")}`);
};

module.exports = buildDir => {
  return readdirAsync(buildDir).then(pageFileNames => {
    const nextPages = pageFileNames
      .map(fileName => {
        const pagePath = path.join(buildDir, fileName);
        const nextPage = new NextPage(pagePath);
        return nextPage;
      })
      .filter(page => !page.pageName.startsWith("_"));

    logPages(nextPages);

    return nextPages;
  });
};
