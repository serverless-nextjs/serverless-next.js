const fs = require("fs");
const { promisify } = require("util");
const getCompatLayerCode = require("./getCompatLayerCode");
const logger = require("../utils/logger");

const writeFileAsync = promisify(fs.writeFile);
const renameAsync = promisify(fs.rename);

const processJsHandler = nextPage => {
  return getCompatLayerCode(nextPage.pagePath).then(compatCodeContent => {
    logger.log(`Creating compat handler for page: ${nextPage.pageName}.js`);
    return writeFileAsync(nextPage.pageCompatPath, compatCodeContent).then(
      () => {
        // build/serverless/page.js -> build/serverless/page.original.js
        return renameAsync(nextPage.pagePath, nextPage.pageOriginalPath).then(
          // .next/serverless/page.compat.js -> .next/serverless/page.js
          () => renameAsync(nextPage.pageCompatPath, nextPage.pagePath)
        );
      }
    );
  });
};

module.exports = nextPages => {
  const promises = nextPages.map(page => processJsHandler(page));
  return Promise.all(promises);
};
