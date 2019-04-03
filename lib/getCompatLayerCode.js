const path = require("path");
const PluginBuildDir = require("../classes/PluginBuildDir");

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

const relativePathToCompatLayerFile = jsHandlerPath => {
  const pathSegments = jsHandlerPath.split(path.sep);
  let relativePathToCompatLayer = "";

  if (pathSegments.length > 2) {
    // this is a nested page in the build directory. e.g. sls-next-build/categories/uno/dos.js
    // compatLayer is in sls-next-build/compatLayer.js
    const buildDirIndex = pathSegments.indexOf(PluginBuildDir.BUILD_DIR_NAME);
    const noLevelsToBuildDir = pathSegments.length - buildDirIndex;

    for (let index = 0; index < noLevelsToBuildDir - 2; index++) {
      relativePathToCompatLayer += "../";
    }
  }

  if (relativePathToCompatLayer === "") {
    // compatLayer is at same level as page
    relativePathToCompatLayer = "./";
  }

  relativePathToCompatLayer += "compatLayer";
  return relativePathToCompatLayer;
};

module.exports = jsHandlerPath => {
  const basename = path.basename(jsHandlerPath, ".js");

  const relativePathToCompatLayer = relativePathToCompatLayerFile(
    jsHandlerPath
  );

  return lambdaHandlerWithCompatLayer
    .replace(PAGE_BUNDLE_PATH, `./${basename}.original.js`)
    .replace(COMPAT_LAYER_PATH, relativePathToCompatLayer);
};
