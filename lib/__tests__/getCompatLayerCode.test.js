const fs = require("fs");
const getCompatLayerCode = require("../getCompatLayerCode");

const compatCodeTemplateFixture =
  'module.exports.render = () => { ... const page = require("/*path_placeholder*/"); ... };';

jest.mock("fs");

describe("getCompatLayerCode", () => {
  let compatCodePromise;

  beforeEach(() => {
    fs.readFile.mockImplementation((path, encoding, cb) =>
      cb(null, compatCodeTemplateFixture)
    );

    compatCodePromise = getCompatLayerCode(".next/serverless/pages/my-page.js");

    return compatCodePromise;
  });

  it("should first read the template file with the compat code", () => {
    expect(fs.readFile).toBeCalledWith(
      expect.stringContaining("compatCode.template"),
      "utf-8",
      expect.any(Function)
    );
  });

  it("should return the compat code content for the given handler path", () => {
    return compatCodePromise.then(compatCode => {
      expect(compatCode).toEqual(
        compatCodeTemplateFixture.replace(
          "/*path_placeholder*/",
          "./my-page.original.js"
        )
      );
    });
  });
});
