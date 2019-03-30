const getCompatLayerCode = require("../getCompatLayerCode");

describe("getCompatLayerCode", () => {
  it("should require compatLayer", () => {
    const compatHandlerContent = getCompatLayerCode(
      "sls-next-build/my-page.js"
    );
    expect(compatHandlerContent).toContain('require("./compatLayer")');
  });

  it("should require compatLayer with correct path when page is nested", () => {
    const compatHandlerContent = getCompatLayerCode(
      "sls-next-build/categories/fridge/fridges.js"
    );
    expect(compatHandlerContent).toContain('require("../../compatLayer")');
  });

  it("should require next page provided", () => {
    const compatHandlerContent = getCompatLayerCode(
      "sls-next-build/my-page.js"
    );
    expect(compatHandlerContent).toContain('require("./my-page.original.js")');
  });

  it("should export render method", () => {
    const compatHandlerContent = getCompatLayerCode(
      "sls-next-build/my-page.js"
    );
    expect(compatHandlerContent).toContain("module.exports.render");
  });
});
