const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

const renameAsync = promisify(fs.rename);

const swapOriginalAndCompatHandlers = (
  functionHandlerPathMap,
  compatHandlerPathMap
) => {
  const promises = Object.entries(compatHandlerPathMap).map(
    ([f, compatHandlerPath]) => {
      const originalHandlerPath = functionHandlerPathMap[f];
      const dirname = path.dirname(originalHandlerPath);
      const basename = path.basename(originalHandlerPath, ".js");
      const originalRenamed = path.join(dirname, `${basename}.original.js`);

      // .next/serverless/page.js -> .next/serverless/page.original.js
      return renameAsync(originalHandlerPath, originalRenamed).then(() => {
        // .next/serverless/page.compat.js -> .next/serverless/page.js
        return renameAsync(compatHandlerPath, originalHandlerPath);
      });
    }
  );

  return Promise.all(promises);
};

module.exports = swapOriginalAndCompatHandlers;
