const fs = require("fs");
const walkDir = require("klaw");
const stream = require("stream");
const path = require("path");
const getNextPagesFromBuildDir = require("../getNextPagesFromBuildDir");
const logger = require("../../utils/logger");
const PluginBuildDir = require("../../classes/PluginBuildDir");

jest.mock("fs");
jest.mock("klaw");
jest.mock("../../utils/logger");

describe("getNextPagesFromBuildDir", () => {
  let mockedStream;

  beforeEach(() => {
    mockedStream = new stream.Readable();
    mockedStream._read = () => {};
    walkDir.mockReturnValueOnce(mockedStream);
    fs.lstatSync.mockReturnValue({ isDirectory: () => false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return an empty array when there are no pages", () => {
    expect.assertions(1);

    const buildDir = path.normalize(`path/to/${PluginBuildDir.BUILD_DIR_NAME}`);

    const getPagesPromise = getNextPagesFromBuildDir(buildDir).then(
      nextPages => {
        expect(nextPages).toEqual([]);
      }
    );

    mockedStream.emit("end");

    return getPagesPromise;
  });

  it("should return two next pages", () => {
    expect.assertions(5);

    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const resolvedBuildDir = path.resolve(buildDir);

    const promise = getNextPagesFromBuildDir(buildDir).then(nextPages => {
      expect(nextPages).toHaveLength(2);
      expect(nextPages[0].pageName).toEqual("index");
      expect(nextPages[0].pagePath).toEqual(path.join(buildDir, "index.js"));
      expect(nextPages[1].pageName).toEqual("about");
      expect(nextPages[1].pagePath).toEqual(path.join(buildDir, "about.js"));
    });

    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "index.js")
    });
    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "about.js")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should pass provided pageConfig to next pages", () => {
    expect.assertions(2);

    const indexPageConfigOverride = { foo: "bar" };
    const aboutPageConfigOverride = { bar: "baz" };

    const pageConfig = {
      index: indexPageConfigOverride,
      about: aboutPageConfigOverride
    };

    const buildDir = path.normalize(
      `/path/to/${PluginBuildDir.BUILD_DIR_NAME}`
    );

    const promise = getNextPagesFromBuildDir(buildDir, pageConfig).then(
      nextPages => {
        expect(nextPages[0].serverlessFunctionOverrides).toEqual(
          indexPageConfigOverride
        );
        expect(nextPages[1].serverlessFunctionOverrides).toEqual(
          aboutPageConfigOverride
        );
      }
    );

    mockedStream.emit("data", { path: path.join(buildDir, "index.js") });
    mockedStream.emit("data", { path: path.join(buildDir, "about.js") });
    mockedStream.emit("end");

    return promise;
  });

  it("should log pages found", () => {
    expect.assertions(1);

    const buildDir = path.normalize("/path/to/build");

    const promise = getNextPagesFromBuildDir(buildDir).then(() => {
      expect(logger.log).toBeCalledWith(`Found 1 next page(s)`);
    });

    mockedStream.emit("data", { path: path.join(buildDir, "about.js") });
    mockedStream.emit("end");

    return promise;
  });

  it("should skip _app and _document pages", () => {
    expect.assertions(2);

    const buildDir = path.normalize(`./${PluginBuildDir.BUILD_DIR_NAME}`);
    const resolvedBuildDir = path.resolve(buildDir);

    const promise = getNextPagesFromBuildDir(buildDir).then(nextPages => {
      expect(nextPages).toHaveLength(1);
      expect(nextPages[0].pageName).toEqual("_error");
    });

    mockedStream.emit("data", { path: path.join(resolvedBuildDir, "_app.js") });
    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "_document.js")
    });
    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "_error.js")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should skip compatLayer file", () => {
    expect.assertions(2);

    const buildDir = path.normalize(
      `/path/to/${PluginBuildDir.BUILD_DIR_NAME}`
    );

    const promise = getNextPagesFromBuildDir(buildDir).then(nextPages => {
      expect(nextPages).toHaveLength(1);
      expect(nextPages[0].pageName).toEqual("home");
    });

    mockedStream.emit("data", { path: path.join(buildDir, "compatLayer.js") });
    mockedStream.emit("data", { path: path.join(buildDir, "home.js") });
    mockedStream.emit("end");

    return promise;
  });

  it("should handle nested pages", () => {
    expect.assertions(5);

    const buildDir = path.normalize(`./${PluginBuildDir.BUILD_DIR_NAME}`);
    const resolvedBuildDir = path.resolve(buildDir);

    const promise = getNextPagesFromBuildDir(buildDir).then(nextPages => {
      expect(nextPages).toHaveLength(2);
      expect(nextPages[0].pageName).toEqual("hello-world");
      expect(nextPages[0].pagePath).toEqual(
        path.join(buildDir, "one", "hello-world.js")
      );
      expect(nextPages[1].pageName).toEqual("hello-world");
      expect(nextPages[1].pagePath).toEqual(
        path.join(buildDir, "one", "two", "hello-world.js")
      );
    });

    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "one", "hello-world.js")
    });
    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "one", "two", "hello-world.js")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should skip page directories", () => {
    expect.assertions(1);

    const buildDir = path.normalize(`./${PluginBuildDir.BUILD_DIR_NAME}`);
    const resolvedBuildDir = path.resolve(buildDir);
    fs.lstatSync.mockReturnValue({ isDirectory: () => true });

    const promise = getNextPagesFromBuildDir(buildDir).then(nextPages => {
      expect(nextPages).toHaveLength(0);
    });

    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "one")
    });
    mockedStream.emit("data", {
      path: path.join(resolvedBuildDir, "one", "two")
    });
    mockedStream.emit("end");

    return promise;
  });
});
