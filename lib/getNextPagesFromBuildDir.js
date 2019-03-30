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

  const resolvedBuildDir = path.resolve(buildDir);
  const buildDirParentDir = path.join(resolvedBuildDir, "..");

  const nextPages = buildFiles
    .map(function normaliseFilePath(fullFilePath) {
      const normalisedFilePath = path.relative(buildDirParentDir, fullFilePath);
      return normalisedFilePath;
    })
    .filter(bf => !excludeBuildFiles.includes(path.basename(bf)))
    .map(normalisedFilePath => {
      const nextPage = new NextPage(normalisedFilePath);
      nextPage.serverlessFunctionOverrides = pageConfig[nextPage.pageName];

      return nextPage;
    });

  logPages(nextPages);

  return nextPages;
};
