const fs = require("fs");
const createHttpServerLambdaCompatHandlers = require("../createHttpServerLambdaCompatHandlers");
const getCompatLayerCode = require("../getCompatLayerCode");

jest.mock("fs");
jest.mock("../getCompatLayerCode");

describe("createHttpServerLambdaCompatHandlers", () => {
  describe("when compat layer is injected successfully", () => {
    let createHttpServerLambdaCompatHandlersPromise;

    beforeEach(() => {
      fs.writeFile.mockImplementation((filePath, data, cb) => {
        cb(null, undefined);
      });

      getCompatLayerCode.mockImplementation(() =>
        Promise.resolve("module.exports={...}")
      );

      createHttpServerLambdaCompatHandlersPromise = createHttpServerLambdaCompatHandlers(
        {
          "home-page": ".next/serverless/pages/home.js",
          "about-page": ".next/serverless/pages/about.js"
        }
      );

      return createHttpServerLambdaCompatHandlersPromise;
    });

    it("should call getCompatLayerCode with the path to the nextjs page bundle", () => {
      expect(getCompatLayerCode).toBeCalledWith(
        ".next/serverless/pages/home.js"
      );
      expect(getCompatLayerCode).toBeCalledWith(
        ".next/serverless/pages/about.js"
      );
    });

    it("should write new js files with the compat layer code", () => {
      expect(fs.writeFile).toBeCalledWith(
        ".next/serverless/pages/home.compat.js",
        "module.exports={...}",
        expect.any(Function)
      );

      expect(fs.writeFile).toBeCalledWith(
        ".next/serverless/pages/about.compat.js",
        "module.exports={...}",
        expect.any(Function)
      );
    });

    it("should resolve with a list of the new compat js handler paths", () => {
      return createHttpServerLambdaCompatHandlersPromise.then(result => {
        expect(result).toEqual({
          "home-page": ".next/serverless/pages/home.compat.js",
          "about-page": ".next/serverless/pages/about.compat.js"
        });
      });
    });
  });
});
