const fs = require("fs");
const rewritePageHandlers = require("../rewritePageHandlers");
const getCompatLayerCode = require("../getCompatLayerCode");
const NextPage = require("../../classes/NextPage");
const logger = require("../../utils/logger");

jest.mock("fs");
jest.mock("../../utils/logger");
jest.mock("../getCompatLayerCode");

describe("rewritePageHandlers", () => {
  describe("when compat layer is injected successfully", () => {
    const pagesDir = "build/serverless/pages";
    let rewritePageHandlersPromise;

    beforeEach(() => {
      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));
      fs.writeFile.mockImplementation((filePath, data, cb) => {
        cb(null, undefined);
      });

      getCompatLayerCode.mockReturnValue("module.exports.render={...}");

      rewritePageHandlersPromise = rewritePageHandlers([
        new NextPage(`${pagesDir}/home.js`),
        new NextPage(`${pagesDir}/about.js`)
      ]);

      return rewritePageHandlersPromise;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should log", () => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("compat handler for page: home.js")
      );
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("compat handler for page: about.js")
      );
    });

    it("should call getCompatLayerCode with the next page path", () => {
      expect(getCompatLayerCode).toBeCalledWith(`${pagesDir}/home.js`);
      expect(getCompatLayerCode).toBeCalledWith(`${pagesDir}/about.js`);
    });

    it("should write new js files with the compat layer code", () => {
      expect(fs.writeFile).toBeCalledWith(
        `${pagesDir}/home.compat.js`,
        "module.exports.render={...}",
        expect.any(Function)
      );

      expect(fs.writeFile).toBeCalledWith(
        `${pagesDir}/about.compat.js`,
        "module.exports.render={...}",
        expect.any(Function)
      );
    });

    it("should rename next handler files and append .original to them", () => {
      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));

      expect(fs.rename).toBeCalledWith(
        `${pagesDir}/home.js`,
        `${pagesDir}/home.original.js`,
        expect.any(Function)
      );

      expect(fs.rename).toBeCalledWith(
        `${pagesDir}/about.js`,
        `${pagesDir}/about.original.js`,
        expect.any(Function)
      );
    });

    it("should set compat handler files as the main handlers", () => {
      expect.assertions(2);

      expect(fs.rename).toBeCalledWith(
        `${pagesDir}/home.compat.js`,
        `${pagesDir}/home.js`,
        expect.any(Function)
      );

      expect(fs.rename).toBeCalledWith(
        `${pagesDir}/about.compat.js`,
        `${pagesDir}/about.js`,
        expect.any(Function)
      );
    });
  });
});
