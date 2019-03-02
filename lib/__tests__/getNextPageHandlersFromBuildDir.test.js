const fs = require("fs");
const getNextPageHandlersFromBuildDir = require("../getNextPageHandlersFromBuildDir");
const logger = require("../../utils/logger");

jest.mock("fs");
jest.mock("../../utils/logger");

describe("getNextPageHandlersFromBuildDir", () => {
  it("should return an empty object when there are no pages", () => {
    expect.assertions(1);

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, []));

    return getNextPageHandlersFromBuildDir("/path/to/build/dir").then(
      pageHandlerMap => {
        expect(pageHandlerMap).toEqual({});
      }
    );
  });

  it("should return a map of the page name and its handler path", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";

    fs.readdir.mockImplementationOnce((path, cb) =>
      cb(null, [
        `${buildDir}/${serverlessSubDir}/index.js`,
        `${buildDir}/${serverlessSubDir}/about.js`
      ])
    );

    return getNextPageHandlersFromBuildDir(buildDir).then(pageHandlerMap => {
      expect(pageHandlerMap).toEqual({
        indexPage: `${buildDir}/${serverlessSubDir}/index.js`,
        aboutPage: `${buildDir}/${serverlessSubDir}/about.js`
      });
    });
  });

  it("should log pages found", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";
    const pageHandlerPath = `${buildDir}/${serverlessSubDir}/admin.js`;

    fs.readdir.mockImplementationOnce((path, cb) =>
      cb(null, [pageHandlerPath])
    );

    return getNextPageHandlersFromBuildDir(buildDir).then(() => {
      expect(logger.log).toBeCalledWith(
        `Found next pages:\n- adminPage: ${pageHandlerPath}`
      );
    });
  });

  it("should skip _ pages like app, document and error", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";
    const serverlessSubDir = "serverless/pages";
    const appHandlerPath = `${buildDir}/${serverlessSubDir}/_app.js`;

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, [appHandlerPath]));

    return getNextPageHandlersFromBuildDir(buildDir).then(pageHandlerMap => {
      expect(pageHandlerMap).toEqual({});
    });
  });
});
