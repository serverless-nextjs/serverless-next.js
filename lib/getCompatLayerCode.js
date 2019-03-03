const fs = require("fs");
const { promisify } = require("util");
const path = require("path");

const readFileAsync = promisify(fs.readFile);

const TOKEN = "/*path_placeholder*/";

module.exports = jsHandlerPath => {
  return readFileAsync(
    path.join(__dirname, "./compatCode.template"),
    "utf-8"
  ).then(template => {
    const basename = path.basename(jsHandlerPath, ".js");
    return template.replace(TOKEN, `./${basename}.original.js`);
  });
};
