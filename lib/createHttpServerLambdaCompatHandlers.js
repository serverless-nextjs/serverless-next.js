const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const getCompatLayerCode = require("./getCompatLayerCode");

const writeFileAsync = promisify(fs.writeFile);

const processJsHandler = (func, handlerPath) => {
  return getCompatLayerCode(handlerPath).then(compatCodeContent => {
    const dirname = path.dirname(handlerPath);
    const basename = path.basename(handlerPath, ".js");
    const compatJsHandlerPath = path.join(dirname, `${basename}.compat.js`);

    return writeFileAsync(compatJsHandlerPath, compatCodeContent).then(() => ({
      [func]: compatJsHandlerPath
    }));
  });
};

module.exports = functionHandlerMap => {
  const promises = Object.keys(functionHandlerMap).map(f =>
    processJsHandler(f, functionHandlerMap[f])
  );

  return Promise.all(promises).then(arrayOfResults =>
    arrayOfResults.reduce((acc, functionHandlerCompatKeyValue) => {
      return { ...acc, ...functionHandlerCompatKeyValue };
    }, {})
  );
};
