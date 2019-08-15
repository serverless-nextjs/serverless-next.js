const fse = require("fs-extra");
const path = require("path");
const NextPage = require("../classes/NextPage");

const writeAssetLambdas = async function() {
  const pluginBuildDir = this.pluginBuildDir;
  const offlineHandlersDir = path.resolve(__dirname, "../offline/");
  const files = await fse.readdir(offlineHandlersDir);

  const pages = [];
  for (const file of files) {
    if (file === "__tests__") {
      continue;
    }
    const source = path.resolve(offlineHandlersDir, file);
    const destination = path.join(pluginBuildDir.buildDir, file);
    await fse.copy(source, destination);
    pages.push(new NextPage(path.join(pluginBuildDir.buildDir, file)));
  }
  return pages;
};

module.exports = writeAssetLambdas;
