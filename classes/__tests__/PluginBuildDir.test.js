const fs = require("fs-extra");
const PluginBuildDir = require("../PluginBuildDir");
const logger = require("../../utils/logger");

jest.mock("fs-extra");
jest.mock("../../utils/logger");

describe("PluginBuildDir", () => {
  describe("#constructor", () => {
    it("should set the next config directory", () => {
      const nextConfigDir = "/path/to/nextApp";
      const pluginBuildDir = new PluginBuildDir(nextConfigDir);

      expect(pluginBuildDir.nextConfigDir).toEqual(nextConfigDir);
    });
  });

  describe("When a new instance is created", () => {
    let pluginBuildDir;

    beforeEach(() => {
      const nextConfigDir = "path/to/nextApp";
      pluginBuildDir = new PluginBuildDir(nextConfigDir);
    });

    it("should have buildDir one level above nextBuild", () => {
      expect(pluginBuildDir.buildDir).toEqual("path/to/nextApp/sls-next-build");
    });
  });

  describe("#setupBuildDir", () => {
    it("should call fs emptyDir to create dir if doesnt exist or cleanup", () => {
      expect.assertions(1);

      fs.emptyDir.mockResolvedValueOnce();
      const nextConfigDir = "path/to/nextApp";

      pluginBuildDir = new PluginBuildDir(nextConfigDir);

      return pluginBuildDir.setupBuildDir().then(() => {
        expect(fs.emptyDir).toBeCalledWith(pluginBuildDir.buildDir);
      });
    });
  });

  describe("#removeBuildDir", () => {
    it("should log when it starts removing", () => {
      expect.assertions(1);

      fs.remove.mockResolvedValueOnce();
      const nextConfigDir = "path/to/nextApp";

      pluginBuildDir = new PluginBuildDir(nextConfigDir);

      return pluginBuildDir.removeBuildDir().then(() => {
        expect(logger.log).toBeCalledWith(
          expect.stringContaining("Cleaning up")
        );
      });
    });

    it("should call fs remove", () => {
      expect.assertions(1);

      fs.remove.mockResolvedValueOnce();
      const nextConfigDir = "path/to/nextApp";

      pluginBuildDir = new PluginBuildDir(nextConfigDir);

      return pluginBuildDir.removeBuildDir().then(() => {
        expect(fs.remove).toBeCalledWith(pluginBuildDir.buildDir);
      });
    });
  });
});
