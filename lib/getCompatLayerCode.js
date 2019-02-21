const fs = require("fs");
const { promisify } = require("util");

const readFileAsync = promisify(fs.readFile);

const TOKEN = "/*path_placeholder*/";

module.exports = jsHandlerPath => {
  return readFileAsync("./compatCode.template").then(template => {
    return template.replace(TOKEN, jsHandlerPath);
  });
};
