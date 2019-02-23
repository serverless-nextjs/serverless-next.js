const fs = require("fs");
const swapOriginalAndCompatHandlers = require("../swapOriginalAndCompatHandlers");

jest.mock("fs");

describe("#swapOriginalAndCompatHandlers", () => {
  it("should rename next handler files and append .original to them", () => {
    fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));

    const compatHandlerPathMap = {
      "home-page": ".next/serverless/pages/home.compat.js",
      "about-page": ".next/serverless/pages/about.compat.js"
    };

    const functionHandlerPathMap = {
      "home-page": ".next/serverless/pages/home.js",
      "about-page": ".next/serverless/pages/about.js"
    };

    return swapOriginalAndCompatHandlers(
      functionHandlerPathMap,
      compatHandlerPathMap
    ).then(() => {
      expect(fs.rename).toBeCalledWith(
        ".next/serverless/pages/home.js",
        ".next/serverless/pages/home.original.js",
        expect.any(Function)
      );
      expect(fs.rename).toBeCalledWith(
        ".next/serverless/pages/about.js",
        ".next/serverless/pages/about.original.js",
        expect.any(Function)
      );
    });
  });

  it("should set compat handler files as the main handlers", () => {
    expect.assertions(2);

    fs.rename.mockImplementation((fileName, newFileName, cb) => cb(null, ""));

    const compatHandlerPathMap = {
      "home-page": ".next/serverless/pages/home.compat.js",
      "about-page": ".next/serverless/pages/about.compat.js"
    };

    const functionHandlerPathMap = {
      "home-page": ".next/serverless/pages/home.js",
      "about-page": ".next/serverless/pages/about.js"
    };

    return swapOriginalAndCompatHandlers(
      functionHandlerPathMap,
      compatHandlerPathMap
    ).then(() => {
      expect(fs.rename).toBeCalledWith(
        ".next/serverless/pages/home.compat.js",
        ".next/serverless/pages/home.js",
        expect.any(Function)
      );
      expect(fs.rename).toBeCalledWith(
        ".next/serverless/pages/about.compat.js",
        ".next/serverless/pages/about.js",
        expect.any(Function)
      );
    });
  });
});
