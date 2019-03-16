const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger");
const copyBuildFiles = require("../copyBuildFiles");

jest.mock("fs");
jest.mock("../../utils/logger");

describe("copyBuildFiles", () => {
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

      const copyBuildDirPromise = copyBuildFiles(
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

    it("should call fs copyFile with the compatLayer file", () => {
      expect(fs.copyFile).toBeCalledWith(
        path.join(__dirname, "..", `compatLayer.js`),
        `${pluginBuildDir}/compatLayer.js`,
        expect.any(Function)
      );
    });
  });
});
