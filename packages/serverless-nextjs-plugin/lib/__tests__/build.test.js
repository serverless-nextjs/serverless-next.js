const path = require("path");
const nextBuild = require("next/dist/build").default;
const fse = require("fs-extra");
const parsedNextConfigurationFactory = require("../../utils/test/parsedNextConfigurationFactory");
const logger = require("../../utils/logger");
const build = require("../build");
const copyBuildFiles = require("../copyBuildFiles");
const parseNextConfiguration = require("../parseNextConfiguration");
const rewritePageHandlers = require("../rewritePageHandlers");
const PluginBuildDir = require("../../classes/PluginBuildDir");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const NextPage = require("../../classes/NextPage");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");

jest.mock("fs-extra");
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
    getNextPagesFromBuildDir.mockResolvedValue([]);
  });

  it("logs when it starts building", () => {
    expect.assertions(1);

    parseNextConfiguration.mockResolvedValueOnce(
      parsedNextConfigurationFactory()
    );

    const plugin = new ServerlessPluginBuilder().build();

    return build.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith("Started building next app ...");
    });
  });

  it("includes plugin build directory for packaging", () => {
    expect.assertions(1);

    const nextConfigDir = "path/to/next-app";

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({ nextConfigDir })
      .build();

    return build.call(plugin).then(() => {
      expect(plugin.serverless.service.package.include).toContain(
        `${nextConfigDir}/${PluginBuildDir.BUILD_DIR_NAME}/**`
      );
    });
  });

  it("includes plugin build directory for packaging when package include isn't defined", () => {
    expect.assertions(1);

    const nextConfigDir = "path/to/next-app";

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({ nextConfigDir })
      .build();

    plugin.serverless.service.package.include = undefined;

    return build.call(plugin).then(() => {
      expect(plugin.serverless.service.package.include).toContain(
        `${nextConfigDir}/${PluginBuildDir.BUILD_DIR_NAME}/**`
      );
    });
  });

  it("includes next-aws-lambda in node_modules/", () => {
    expect.assertions(1);

    const nextConfigDir = "path/to/next-app";

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({ nextConfigDir })
      .build();

    return build.call(plugin).then(() => {
      expect(plugin.serverless.service.package.include).toContain(
        `node_modules/next-aws-lambda/**`
      );
    });
  });

  it("copies build files", () => {
    expect.assertions(2);

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);
    const nextConfigDir = "path/to/next-app";

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        nextConfigDir
      })
      .build();

    return build.call(plugin).then(() => {
      expect(parseNextConfiguration).toBeCalledWith(nextConfigDir);
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        parsedNextConfig.nextConfiguration
      );
    });
  });

  it("copies custom handler provided", () => {
    expect.assertions(1);

    const parsedNextConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedNextConfig);
    const nextConfigDir = "path/to/next-app";

    const customHandlerPath = "./path/to/handler.js";

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        nextConfigDir,
        customHandler: customHandlerPath
      })
      .build();

    return build.call(plugin).then(() => {
      expect(fse.copy).toBeCalledWith(
        path.resolve(nextConfigDir, customHandlerPath),
        path.join(plugin.pluginBuildDir.buildDir, customHandlerPath)
      );
    });
  });

  it('overrides nextConfig target if is not "serverless" and log it', () => {
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

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        nextConfigDir
      })
      .build();

    return build.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining('Target "server" found')
      );
      expect(nextBuild).toBeCalledWith(
        path.resolve(nextConfigDir),
        expectedNextConfig
      );
    });
  });

  it("rewrites the page handlers for each next page", () => {
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
    const routes = [];
    const customHandler = undefined;

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        pageConfig,
        routes,
        nextConfigDir
      })
      .build();

    return build.call(plugin).then(() => {
      expect(getNextPagesFromBuildDir).toBeCalledWith(
        new PluginBuildDir(nextConfigDir).buildDir,
        {
          pageConfig,
          routes,
          additionalExcludes: customHandler
        }
      );
      expect(rewritePageHandlers).toBeCalledWith(nextPages, undefined);
    });
  });

  it("sets the next page functions for deployment", () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);

    const mockNextPages = [new NextPage("/foo/bar"), new NextPage("/foo/baz")];
    getNextPagesFromBuildDir.mockResolvedValueOnce(mockNextPages);

    const setFunctionNamesMock = jest.fn();

    const plugin = new ServerlessPluginBuilder()
      .withService({
        setFunctionNames: setFunctionNamesMock
      })
      .build();

    return build.call(plugin).then(() => {
      expect(setFunctionNamesMock).toBeCalled();
      expect(Object.keys(plugin.serverless.service.functions)).toEqual([
        "foo-bar",
        "foo-baz"
      ]);
    });
  });

  it("returns NextPage instances for each next page copied", () => {
    expect.assertions(2);

    const parsedConfig = parsedNextConfigurationFactory();
    parseNextConfiguration.mockResolvedValueOnce(parsedConfig);
    const mockNextPages = [new NextPage("/foo/bar"), new NextPage("/foo/baz")];
    getNextPagesFromBuildDir.mockResolvedValueOnce(mockNextPages);

    const nextConfigDir = "path/to/next-app";

    const pageConfig = {};
    const routes = [];
    const customHandler = undefined;

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        pageConfig,
        routes,
        nextConfigDir
      })
      .build();

    return build.call(plugin).then(nextPages => {
      expect(getNextPagesFromBuildDir).toBeCalledWith(
        new PluginBuildDir(nextConfigDir).buildDir,
        { pageConfig, routes, additionalExcludes: customHandler }
      );
      expect(nextPages).toEqual(mockNextPages);
    });
  });
});
