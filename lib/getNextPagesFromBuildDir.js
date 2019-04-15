const path = require("path");
const walkDir = require("klaw");
const fs = require("fs");
const logger = require("../utils/logger");
const NextPage = require("../classes/NextPage");

const logPages = nextPages => {
  const pageNames = nextPages.map(p => p.pageName);
  logger.log(`Found ${pageNames.length} next page(s)`);
};

const excludeBuildFiles = ["_app.js", "_document.js", "compatLayer.js"];
const SOURCE_MAP_EXT = ".map";

const getBuildFiles = buildDir => {
  const buildFiles = [];
  return new Promise(resolve => {
    const stream = walkDir(buildDir);
    stream
      .on("data", item => {
        const isFile = !fs.lstatSync(item.path).isDirectory();

        if (isFile) {
          buildFiles.push(item.path);
        }
      })
      .on("end", () => {
        resolve(buildFiles);
      });
  });
};

module.exports = async (buildDir, pageConfig = {}) => {
  const buildFiles = await getBuildFiles(buildDir);
  const [buildDirRoot] = buildDir.split(path.sep);

  const nextPages = buildFiles
    .map(function normaliseFilePath(fullFilePath) {
      const pathSegments = fullFilePath.split(path.sep);
      const buildDirIndex = pathSegments.indexOf(buildDirRoot);

      return path.join.apply(
        null,
        pathSegments.slice(buildDirIndex, pathSegments.length)
      );
    })
    .filter(bf => !excludeBuildFiles.includes(path.basename(bf)))
    .filter(bf => !bf.endsWith(SOURCE_MAP_EXT))
    .map(normalisedFilePath => {
      const nextPage = new NextPage(normalisedFilePath);
      nextPage.serverlessFunctionOverrides = pageConfig[nextPage.pageName];

      return nextPage;
    });

  logPages(nextPages);

  return nextPages;
};
