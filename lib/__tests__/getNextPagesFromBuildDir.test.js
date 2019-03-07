const fs = require("fs");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const logger = require("../../utils/logger");

jest.mock("fs");
jest.mock("../../utils/logger");

describe("getNextPagesFromBuildDir", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return an empty array when there are no pages", () => {
    expect.assertions(1);

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, []));

    return getNextPagesFromBuildDir("/path/to/build/dir").then(nextPages => {
      expect(nextPages).toEqual([]);
    });
  });

  it("should return two next pages", () => {
    expect.assertions(3);

    fs.readdir.mockImplementationOnce((path, cb) =>
      cb(null, ["index.js", "about.js"])
    );

    return getNextPagesFromBuildDir("/path/to/build").then(nextPages => {
      expect(nextPages).toHaveLength(2);
      expect(nextPages[0].pageName).toEqual("index");
      expect(nextPages[1].pageName).toEqual("about");
    });
  });

  it("should log pages found", () => {
    expect.assertions(1);

    const buildDir = "/path/to/build";

    fs.readdir.mockImplementationOnce((path, cb) => cb(null, ["admin.js"]));

    return getNextPagesFromBuildDir(buildDir).then(() => {
      expect(logger.log).toBeCalledWith(`Found 1 next page(s)`);
    });
  });

  it("should skip _ pages like app, document and error", () => {
    expect.assertions(1);

    fs.readdir.mockImplementationOnce((path, cb) =>
      cb(null, ["_app", "_document"])
    );

    return getNextPagesFromBuildDir("/path/to/build").then(nextPages => {
      expect(nextPages).toEqual([]);
    });
  });
});
