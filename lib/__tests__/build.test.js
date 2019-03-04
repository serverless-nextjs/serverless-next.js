const path = require("path");
const nextBuild = require("next/dist/build").default;
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const logger = require("../../utils/logger");
const build = require("../build");
const copyNextPages = require("../copyNextPages");
const parseNextConfiguration = require("../parseNextConfiguration");
const rewritePageHandlers = require("../rewritePageHandlers");
const PluginBuildDir = require("../../classes/PluginBuildDir");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const NextPage = require("../../classes/NextPage");

jest.mock("next/dist/build");
jest.mock("../../utils/logger");
jest.mock("../copyNextPages");
jest.mock("../parseNextConfiguration");
jest.mock("../getNextPagesFromBuildDir");
jest.mock("../rewritePageHandlers");

describe("build", () => {
  beforeEach(() => {
    nextBuild.mockResolvedValueOnce();
    copyNextPages.mockResolvedValueOnce();
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

    return build(nextConfigDir).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining("building next app")
      );
    });
  });

  it("should call parseNextConfiguration with nextConfigDir", () => {
    expect.assertions(1);

    parseNextConfiguration.mockResolvedValueOnce(
      parsedNextConfigurationFactory()
    );
    const nextConfigDir = "path/to/next-app";

    return build(nextConfigDir).then(() => {
      expect(parseNextConfiguration).toBeCalledWith(nextConfigDir);
    });
  });

  it("should call nextBuild with nextConfigDir and nextConfiguration", () => {
    expect.assertions(1);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    const nextConfigDir = "path/to/next-app";

    return build(nextConfigDir).then(() => {
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        parsedConfig.nextConfiguration
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

    return build(nextConfigDir).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining('Target "server" found')
      );
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        expectedNextConfig
      );
    });
  });

  it("should call copyNextPages with nextBuildDir and pluginBuildDir after nextBuild finishes", () => {
    expect.assertions(1);

    const parsedConfig = parsedNextConfigurationFactory();
    const nextConfig = parsedConfig.nextConfiguration;
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);

    const nextConfigDir = "path/to/next-app";

    return build(nextConfigDir).then(() => {
      expect(copyNextPages).toBeCalledWith(
        path.join(nextConfigDir, nextConfig.distDir),
        new PluginBuildDir(nextConfigDir)
      );
    });
  });

  it("should call getNextPagesFromBuildDir and return NextPage instances for each nextPage copied", () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    const mockNextPages = [new NextPage("/foo/bar"), new NextPage("/foo/baz")];
    getNextPagesFromBuildDir.mockResolvedValueOnce(mockNextPages);

    const nextConfigDir = "path/to/next-app";

    return build(nextConfigDir).then(nextPages => {
      expect(getNextPagesFromBuildDir).toBeCalledWith(
        new PluginBuildDir(nextConfigDir).buildDir
      );
      expect(nextPages).toEqual(mockNextPages);
    });
  });

  it("should call getNextPagesFromBuildDir and return NextPage instances for each nextPage copied", () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    const mockNextPages = [new NextPage("/foo/bar"), new NextPage("/foo/baz")];
    getNextPagesFromBuildDir.mockResolvedValueOnce(mockNextPages);

    const nextConfigDir = "path/to/next-app";

    return build(nextConfigDir).then(nextPages => {
      expect(getNextPagesFromBuildDir).toBeCalledWith(
        new PluginBuildDir(nextConfigDir).buildDir
      );
      expect(nextPages).toEqual(mockNextPages);
    });
  });

  it("should call rewritePageHandlers with next pages", () => {
    expect.assertions(1);

    const nextConfigDir = "path/to/next-app";
    const pagesDir = "build/serverless/pages";
    const nextPages = [
      new NextPage(`${pagesDir}/foo.js`),
      new NextPage(`${pagesDir}/baz.js`)
    ];
    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    getNextPagesFromBuildDir.mockResolvedValueOnce(nextPages);

    return build(nextConfigDir).then(() => {
      expect(rewritePageHandlers).toBeCalledWith(nextPages);
    });
  });
});
