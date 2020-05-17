import fse from "fs-extra";
import os from "os";
import path from "path";
import Builder from "../../../src/build";
import {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} from "../../../src/build";

describe("Serverless Trace", () => {
  const fixturePath = path.join(__dirname, "../");
  let outputDir: string;
  let fseRemoveSpy: jest.SpyInstance;

  beforeEach(async () => {
    outputDir = os.tmpdir();

    fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
      return;
    });

    const builder = new Builder(fixturePath, outputDir);

    await builder.build();
  });

  afterEach(() => {
    fseRemoveSpy.mockRestore();
  });

  it("copies api page dependencies to api lambda artefact", async () => {
    const nodeModulesPath = path.join(
      outputDir,
      API_LAMBDA_CODE_DIR,
      "node_modules"
    );

    const nodeModulesExists = await fse.pathExists(nodeModulesPath);
    expect(nodeModulesExists).toBe(true);

    const nodeModulesFiles = await fse.readdir(nodeModulesPath);
    expect(nodeModulesFiles).toEqual(
      expect.arrayContaining(["api-dependency-a", "api-dependency-b"])
    );

    const dependencyAPath = path.join(nodeModulesPath, "api-dependency-a");
    const dependencyAFiles = await fse.readdir(dependencyAPath);
    expect(dependencyAFiles).toEqual(expect.arrayContaining(["index.js"]));

    const dependencyBPath = path.join(nodeModulesPath, "api-dependency-b");
    const dependencyBFiles = await fse.readdir(dependencyBPath);
    expect(dependencyBFiles).toEqual(expect.arrayContaining(["index.js"]));
  });

  it("copies ssr page dependencies to lambda artefact", async () => {
    const nodeModulesPath = path.join(
      outputDir,
      DEFAULT_LAMBDA_CODE_DIR,
      "node_modules"
    );

    const nodeModulesExists = await fse.pathExists(nodeModulesPath);
    expect(nodeModulesExists).toBe(true);

    const nodeModulesFiles = await fse.readdir(nodeModulesPath);
    expect(nodeModulesFiles).toEqual(
      expect.arrayContaining(["dependency-a", "dependency-b"])
    );

    const dependencyAPath = path.join(nodeModulesPath, "dependency-a");
    const dependencyAFiles = await fse.readdir(dependencyAPath);
    expect(dependencyAFiles).toEqual(
      expect.arrayContaining(["index.js", "sub-dependency.js"])
    );

    const dependencyBPath = path.join(nodeModulesPath, "dependency-b");
    const dependencyBFiles = await fse.readdir(dependencyBPath);
    expect(dependencyBFiles).toEqual(expect.arrayContaining(["index.js"]));
  });

  it("does not copy any .next/ files into lambda artefact", async () => {
    const nodeModulesPath = path.join(
      outputDir,
      DEFAULT_LAMBDA_CODE_DIR,
      ".next"
    );

    const dotNextDirExists = await fse.pathExists(nodeModulesPath);
    expect(dotNextDirExists).toBe(false);
  });
});
