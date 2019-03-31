const path = require("path");
const fse = require("fs-extra");
const logger = require("../../utils/logger");
const copyBuildFiles = require("../copyBuildFiles");

jest.mock("fs-extra");
jest.mock("../../utils/logger");

describe("copyBuildFiles", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when page files are copied correctly", () => {
    let pluginBuildDirObj;
    const pluginBuildDir = path.normalize("path/to/sls-next-build");
    const nextBuildDir = path.normalize("path/to/.next");

    beforeEach(() => {
      fse.copy.mockResolvedValue(null);

      pluginBuildDirObj = {
        buildDir: pluginBuildDir,
        setupBuildDir: jest.fn().mockResolvedValue()
      };

      const copyBuildDirPromise = copyBuildFiles(
        nextBuildDir,
        pluginBuildDirObj
      );
      return copyBuildDirPromise;
    });

    it("should log it has started copying", () => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("Copying next pages")
      );
    });

    it("should copy serverless pages folder from next build directory", () => {
      expect(fse.copy).toBeCalledWith(
        path.join(nextBuildDir, "serverless/pages"),
        pluginBuildDir
      );
    });

    it("should cleanup pluginBuildDir before copying", () => {
      expect(pluginBuildDirObj.setupBuildDir).toBeCalled();
    });

    it("should call fs copy with the compatLayer file", () => {
      expect(fse.copy).toBeCalledWith(
        path.join(__dirname, "..", `compatLayer.js`),
        path.join(pluginBuildDir, "compatLayer.js")
      );
    });
  });
});
