const path = require("path");

const PAGE_BUNDLE_PATH = "/*page_bundle_path_placeholder*/";
const COMPAT_LAYER_PATH = "/*compat_layer_path_placeholder*/";

const lambdaHandlerWithCompatLayer = `
  const reqResMapper = require("${COMPAT_LAYER_PATH}");
  const page = require("${PAGE_BUNDLE_PATH}");

  module.exports.render = (event, context, callback) => {
    const { req, res } = reqResMapper(event, callback);
    page.render(req, res);
  };
`;

const fixCompatLayerPath = p => {
  // path.relative doesn't check if is a file or dir
  // this makes sure the path is actually correct
  // https://stackoverflow.com/questions/31023972/node-path-relative-returns-incorrect-path
  if (p.startsWith("../compatLayer")) {
    return p.replace(path.normalize("../"), path.normalize("./"));
  } else {
    return p.replace(path.normalize("../"), "");
  }
};

module.exports = jsHandlerPath => {
  const basename = path.basename(jsHandlerPath, ".js");
  const [rootDir] = jsHandlerPath.split(path.sep);
  const pathToCompatLayer = path.resolve(path.join(rootDir, "compatLayer"));
  let relativePathToCompatLayer = path.relative(
    jsHandlerPath,
    pathToCompatLayer
  );

  relativePathToCompatLayer = fixCompatLayerPath(relativePathToCompatLayer);

  return lambdaHandlerWithCompatLayer
    .replace(PAGE_BUNDLE_PATH, `./${basename}.original.js`)
    .replace(COMPAT_LAYER_PATH, relativePathToCompatLayer);
};
