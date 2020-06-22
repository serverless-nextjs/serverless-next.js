const fs = require("fs");
const { promisify } = require("util");
const getFactoryHandlerCode = require("./getFactoryHandlerCode");
const logger = require("../utils/logger");

const processJsHandler = async (nextPage, customHandler) => {
  const writeFileAsync = promisify(fs.writeFile);
  const renameAsync = promisify(fs.rename);

  const compatCodeContent = getFactoryHandlerCode(
    nextPage.pagePath,
    customHandler
  );

  logger.log(`Creating compat handler for page: ${nextPage.pageId}.js`);

  await writeFileAsync(nextPage.pageCompatPath, compatCodeContent);

  // sls-next-build/page.js -> sls-next-build/page.original.js
  await renameAsync(nextPage.pagePath, nextPage.pageOriginalPath);

  // sls-next-build/page.compat.js -> sls-next-build/page.js
  await renameAsync(nextPage.pageCompatPath, nextPage.pagePath);
};

module.exports = (nextPages, customHandler) => {
  const promises = nextPages.map((page) =>
    processJsHandler(page, customHandler)
  );
  return Promise.all(promises);
};
