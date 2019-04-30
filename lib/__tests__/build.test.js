const path = require("path");
const nextBuild = require("next/dist/build").default;
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const logger = require("../../utils/logger");
const build = require("../build");
const copyBuildFiles = require("../copyBuildFiles");
const parseNextConfiguration = require("../parseNextConfiguration");
const rewritePageHandlers = require("../rewritePageHandlers");
const PluginBuildDir = require("../../classes/PluginBuildDir");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const NextPage = require("../../classes/NextPage");

jest.mock("next/dist/build");
jest.mock("../../utils/logger");
jest.mock("../copyBuildFiles");
jest.mock("../parseNextConfiguration");
jest.mock("../getNextPagesFromBuildDir");
jest.mock("../rewritePageHandlers");

describe("build", () => {
  beforeEach(() => {
    nextBuild.mockResolvedValueOnce();
    copyBuildFiles.mockResolvedValueOnce();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log when it starts building", () => {
    expect.assertions(1);

    parseNextConfiguration.mockResolvedValueOnce(
      parsedNextConfigurationFactory()
    );
    const nextConfigDir = "path/to/next-app";

    return build(new PluginBuildDir(nextConfigDir)).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("building next app")
      );
    });
  });

  it("should copy build files", () => {
    expect.assertions(2);

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);
    const nextConfigDir = "path/to/next-app";

    return build(new PluginBuildDir(nextConfigDir)).then(() => {
      expect(parseNextConfiguration).toBeCalledWith(nextConfigDir);
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        parsedNextConfig.nextConfiguration
      );
    });
  });

  it('should override nextConfig target if is not "serverless" and log it', () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory({
      target: "server",
      distDir: ".next"
    });

    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);

    const nextConfigDir = "path/to/next-app";
    const expectedNextConfig = {
      ...parsedConfig.nextConfiguration,
      target: "serverless"
    };

    return build(new PluginBuildDir(nextConfigDir)).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining('Target "server" found')
      );
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        expectedNextConfig
      );
    });
  });

  it("should rewrite the page handlers for each next page", () => {
    expect.assertions(2);

    const nextConfigDir = "path/to/next-app";
    const pagesDir = "build/serverless/pages";
    const nextPages = [
      new NextPage(`${pagesDir}/foo.js`),
      new NextPage(`${pagesDir}/baz.js`)
    ];
    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    getNextPagesFromBuildDir.mockResolvedValueOnce(nextPages);

    const pageConfig = {};
    const customHandler = undefined;

    return build(
      new PluginBuildDir(nextConfigDir),
      pageConfig,
      customHandler
    ).then(() => {
      expect(getNextPagesFromBuildDir).toBeCalledWith(
        new PluginBuildDir(nextConfigDir).buildDir,
        pageConfig,
        customHandler
      );
      expect(rewritePageHandlers).toBeCalledWith(nextPages, undefined);
    });
  });

  it("should return NextPage instances for each next page copied", () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    const mockNextPages = [new NextPage("/foo/bar"), new NextPage("/foo/baz")];
    getNextPagesFromBuildDir.mockResolvedValueOnce(mockNextPages);

    const nextConfigDir = "path/to/next-app";

    const pageConfig = {};
    const customHandler = undefined;

    return build(new PluginBuildDir(nextConfigDir), pageConfig).then(
      nextPages => {
        expect(getNextPagesFromBuildDir).toBeCalledWith(
          new PluginBuildDir(nextConfigDir).buildDir,
          pageConfig,
          customHandler
        );
        expect(nextPages).toEqual(mockNextPages);
      }
    );
  });
});
