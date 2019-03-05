const fs = require("fs");
const { promisify } = require("util");
const getCompatLayerCode = require("./getCompatLayerCode");
const logger = require("../utils/logger");

const writeFileAsync = promisify(fs.writeFile);
const renameAsync = promisify(fs.rename);

const processJsHandler = async nextPage => {
  const compatCodeContent = await getCompatLayerCode(nextPage.pagePath);

  logger.log(`Creating compat handler for page: ${nextPage.pageName}.js`);

  await writeFileAsync(nextPage.pageCompatPath, compatCodeContent);

  // build/serverless/page.js -> build/serverless/page.original.js
  await renameAsync(nextPage.pagePath, nextPage.pageOriginalPath);

  // .next/serverless/page.compat.js -> .next/serverless/page.js
  await renameAsync(nextPage.pageCompatPath, nextPage.pagePath);
};

module.exports = nextPages => {
  const promises = nextPages.map(page => processJsHandler(page));
  return Promise.all(promises);
};
