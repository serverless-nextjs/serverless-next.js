const path = require("path");
const getCompatLayerCode = require("../getCompatLayerCode");
const PluginBuildDir = require("../../classes/PluginBuildDir");

describe("getCompatLayerCode", () => {
  it("should require compatLayer", () => {
    const compatHandlerContent = getCompatLayerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain('require("./compatLayer")');
  });

  it("should require compatLayer with correct path when page is nested", () => {
    const compatHandlerContent = getCompatLayerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "categories/fridge/fridges.js")
    );
    expect(compatHandlerContent).toContain('require("../../compatLayer")');
  });

  it("should require compatLayer with correct path when buildDir is nested", () => {
    const compatHandlerContent = getCompatLayerCode(
      path.join(`app/${PluginBuildDir.BUILD_DIR_NAME}`, "page.js")
    );
    expect(compatHandlerContent).toContain('require("./compatLayer")');
  });

  it("should require next page provided", () => {
    const compatHandlerContent = getCompatLayerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain('require("./my-page.original.js")');
  });

  it("should export render method", () => {
    const compatHandlerContent = getCompatLayerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain("module.exports.render");
  });
});
