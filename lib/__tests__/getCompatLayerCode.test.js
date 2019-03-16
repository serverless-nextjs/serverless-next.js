const getCompatLayerCode = require("../getCompatLayerCode");

describe("getCompatLayerCode", () => {
  it("should require compatLayer", () => {
    const compatHandlerContent = getCompatLayerCode(
      ".next/serverless/pages/my-page.js"
    );
    expect(compatHandlerContent).toContain(`require("./compatLayer")`);
  });

  it("should require next page provided", () => {
    const compatHandlerContent = getCompatLayerCode(
      ".next/serverless/pages/my-page.js"
    );
    expect(compatHandlerContent).toContain(`require("./my-page.original.js")`);
  });

  it("should export render method", () => {
    const compatHandlerContent = getCompatLayerCode(
      ".next/serverless/pages/my-page.js"
    );
    expect(compatHandlerContent).toContain(`module.exports.render`);
  });
});
