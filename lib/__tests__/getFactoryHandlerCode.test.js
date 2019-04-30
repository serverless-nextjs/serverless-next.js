const path = require("path");
const getFactoryHandlerCode = require("../getFactoryHandlerCode");
const PluginBuildDir = require("../../classes/PluginBuildDir");

describe("getFactoryHandlerCode", () => {
  it("should require compatLayer", () => {
    const compatHandlerContent = getFactoryHandlerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain(
      'require("serverless-nextjs-plugin/aws-lambda-compat")'
    );
  });

  it("should require compatLayer with correct path when page is nested", () => {
    const compatHandlerContent = getFactoryHandlerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "categories/fridge/fridges.js")
    );
    expect(compatHandlerContent).toContain(
      'require("serverless-nextjs-plugin/aws-lambda-compat")'
    );
  });

  it("should require compatLayer with correct path when buildDir is nested", () => {
    const compatHandlerContent = getFactoryHandlerCode(
      path.join(`app/${PluginBuildDir.BUILD_DIR_NAME}`, "page.js")
    );
    expect(compatHandlerContent).toContain(
      'require("serverless-nextjs-plugin/aws-lambda-compat")'
    );
  });

  it("should require next page provided", () => {
    const compatHandlerContent = getFactoryHandlerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain('require("./my-page.original.js")');
  });

  it("should export render method", () => {
    const compatHandlerContent = getFactoryHandlerCode(
      path.join(PluginBuildDir.BUILD_DIR_NAME, "my-page.js")
    );
    expect(compatHandlerContent).toContain("module.exports.render");
  });
});
