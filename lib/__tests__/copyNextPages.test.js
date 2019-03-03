const fs = require("fs");
const logger = require("../../utils/logger");
const copyNextPages = require("../copyNextPages");

jest.mock("fs");
jest.mock("../../utils/logger");

describe("copyNextPages", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when page files are copied correctly", () => {
    let pluginBuildDirObj;
    const pluginBuildDir = "path/to";
    const nextBuildDir = "path/to/.next";

    beforeEach(() => {
      fs.readdir.mockImplementation((dir, cb) =>
        cb(null, ["home.js", "about.js"])
      );

      fs.copyFile.mockImplementation((src, dest, cb) => cb(null, {}));

      pluginBuildDirObj = {
        buildDir: pluginBuildDir,
        setupBuildDir: jest.fn().mockResolvedValue()
      };

      const copyBuildDirPromise = copyNextPages(
        nextBuildDir,
        pluginBuildDirObj
      );
      return copyBuildDirPromise;
    });

    it("should log it has started copying", () => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("Copying next pages")
      );
    });

    it("should call fs readdir to read all page files", () => {
      expect(fs.readdir).toBeCalledWith(
        `${nextBuildDir}/serverless/pages`,
        expect.any(Function)
      );
    });

    it("should cleanup pluginBuildDir before copying", () => {
      expect(pluginBuildDirObj.setupBuildDir).toBeCalled();
    });

    it("should call fs copyFile with the page files read", () => {
      expect(fs.copyFile).toBeCalledWith(
        `${nextBuildDir}/serverless/pages/home.js`,
        `${pluginBuildDir}/home.js`,
        expect.any(Function)
      );

      expect(fs.copyFile).toBeCalledWith(
        `${nextBuildDir}/serverless/pages/about.js`,
        `${pluginBuildDir}/about.js`,
        expect.any(Function)
      );
    });
  });
});
