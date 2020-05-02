const path = require("path");
const fs = require("fs");
const rewritePageHandlers = require("../rewritePageHandlers");
const getFactoryHandlerCode = require("../getFactoryHandlerCode");
const NextPage = require("../../classes/NextPage");
const logger = require("../../utils/logger");

jest.mock("fs");
jest.mock("../../utils/logger");
jest.mock("../getFactoryHandlerCode");

describe("rewritePageHandlers", () => {
  describe("when compat layer is injected successfully", () => {
    const pagesDir = "build/serverless/pages";
    let rewritePageHandlersPromise;

    beforeEach(() => {
      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));
      fs.writeFile.mockImplementation((filePath, data, cb) => {
        cb(null, undefined);
      });

      getFactoryHandlerCode.mockReturnValue("module.exports.render={...}");

      rewritePageHandlersPromise = rewritePageHandlers([
        new NextPage(path.join(pagesDir, "home.js")),
        new NextPage(path.join(pagesDir, "about.js"))
      ]);

      return rewritePageHandlersPromise;
    });

    it("should log", () => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(
          "compat handler for page: build/serverless/pages/home.js"
        )
      );
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(
          "compat handler for page: build/serverless/pages/about.js"
        )
      );
    });

    it("should call getFactoryHandlerCode with the next page path", () => {
      expect(getFactoryHandlerCode).toBeCalledWith(
        path.join(pagesDir, "home.js"),
        undefined
      );
      expect(getFactoryHandlerCode).toBeCalledWith(
        path.join(pagesDir, "about.js"),
        undefined
      );
    });

    it("should write new js files with the compat layer code", () => {
      expect(fs.writeFile).toBeCalledWith(
        path.join(pagesDir, "home.compat.js"),
        "module.exports.render={...}",
        expect.any(Function)
      );

      expect(fs.writeFile).toBeCalledWith(
        path.join(pagesDir, "about.compat.js"),
        "module.exports.render={...}",
        expect.any(Function)
      );
    });

    it("should rename next handler files and append .original to them", () => {
      fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));

      expect(fs.rename).toBeCalledWith(
        path.join(pagesDir, "home.js"),
        path.join(pagesDir, "home.original.js"),
        expect.any(Function)
      );

      expect(fs.rename).toBeCalledWith(
        path.join(pagesDir, "about.js"),
        path.join(pagesDir, "about.original.js"),
        expect.any(Function)
      );
    });

    it("should set compat handler files as the main handlers", () => {
      expect.assertions(2);

      expect(fs.rename).toBeCalledWith(
        path.join(pagesDir, "home.compat.js"),
        path.join(pagesDir, "home.js"),
        expect.any(Function)
      );

      expect(fs.rename).toBeCalledWith(
        path.join(pagesDir, "about.compat.js"),
        path.join(pagesDir, "about.js"),
        expect.any(Function)
      );
    });
  });
});
