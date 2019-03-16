const path = require("path");

const lambdaHandlerWithCompatLayer = `
const reqResMapper = require("./compatLayer");
const page = require("/*path_placeholder*/");

module.exports.render = (event, context, callback) => {
  const { req, res } = reqResMapper(event, callback);
  page.render(req, res);
};
`;

const TOKEN = "/*path_placeholder*/";

module.exports = jsHandlerPath => {
  const basename = path.basename(jsHandlerPath, ".js");
  return lambdaHandlerWithCompatLayer.replace(
    TOKEN,
    `./${basename}.original.js`
  );
};
