const pathToRegexp = require("path-to-regexp");

module.exports = path =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, "$1");
