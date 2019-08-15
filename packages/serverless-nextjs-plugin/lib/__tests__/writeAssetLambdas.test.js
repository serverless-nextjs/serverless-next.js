const fse = require("fs-extra");
const path = require("path");
const PluginBuildDir = require("../../classes/PluginBuildDir");
const writeAssetLambdas = require("../writeAssetLambdas");

jest.mock("fs-extra");

describe("writeAssetLambdas", () => {
  beforeEach(() => {
    fse.copy.mockResolvedValue(null);
  });
  it("should copy offline handlers", async () => {
    fse.readdir.mockResolvedValue(["_next.js"]);
    const pluginBuildDir = new PluginBuildDir("test");
    await writeAssetLambdas.call({
      pluginBuildDir
    });
    expect(fse.copy).toBeCalledWith(
      path.resolve(__dirname, "../../offline/_next.js"),
      path.join(pluginBuildDir.buildDir, "_next.js")
    );
  });
  it("should not copy test files", async () => {
    fse.readdir.mockResolvedValue(["__tests__"]);
    const pluginBuildDir = new PluginBuildDir("test");
    await writeAssetLambdas.call({
      pluginBuildDir
    });
    expect(fse.copy).not.toBeCalled();
  });
});
