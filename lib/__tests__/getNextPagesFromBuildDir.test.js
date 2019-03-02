const fs = require("fs");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const logger = require("../../utils/logger");

jest.mock("fs");
jest.mock("../../utils/logger");

describe("getNextPagesFromBuildDir", () => {
  it("should return an empty object when there are no pages", () => {
    expect.assertions(1);

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, []));

    return getNextPagesFromBuildDir("/path/to/build/dir").then(
      pageNameAndPathMap => {
        expect(pageNameAndPathMap).toEqual({});
      }
    );
  });

  it("should return a map of the page name and path", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";

    fs.readdir.mockImplementationOnce((path, cb) =>
      cb(null, [
        `${buildDir}/${serverlessSubDir}/index.js`,
        `${buildDir}/${serverlessSubDir}/about.js`
      ])
    );

    return getNextPagesFromBuildDir(buildDir).then(pageNameAndPathMap => {
      expect(pageNameAndPathMap).toEqual({
        indexPage: `${buildDir}/${serverlessSubDir}/index.js`,
        aboutPage: `${buildDir}/${serverlessSubDir}/about.js`
      });
    });
  });

  it("should log pages found", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";
    const pagePath = `${buildDir}/${serverlessSubDir}/admin.js`;

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, [pagePath]));

    return getNextPagesFromBuildDir(buildDir).then(() => {
      expect(logger.log).toBeCalledWith(
        `Found next pages:\n- adminPage: ${pagePath}`
      );
    });
  });

  it("should skip _ pages like app, document and error", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";
    const appPagePath = `${buildDir}/${serverlessSubDir}/_app.js`;

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, [appPagePath]));

    return getNextPagesFromBuildDir(buildDir).then(pageNameAndPathMap => {
      expect(pageNameAndPathMap).toEqual({});
    });
  });
});
