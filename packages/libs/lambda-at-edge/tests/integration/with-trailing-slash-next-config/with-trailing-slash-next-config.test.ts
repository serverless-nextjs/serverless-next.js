import { getNextBinary, removeNewLineChars } from "../../test-utils";
import os from "os";
import path, { join } from "path";
import Builder, { DEFAULT_LAMBDA_CODE_DIR } from "../../../src/build";
import fse, { readFile, remove, pathExists } from "fs-extra";
import { OriginRequestDefaultHandlerManifest } from "../../../types";

jest.unmock("execa");

describe("With Trailing Slash Config Build", () => {
  const nextBinary = getNextBinary();
  const fixtureDir = path.join(__dirname, "./fixture");
  let outputDir: string;
  let mockDateNow: jest.SpyInstance<number, []>;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;

  beforeAll(async () => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(123);
    outputDir = path.join(os.tmpdir(), "slsnext-test-build");
    const builder = new Builder(fixtureDir, outputDir, {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();

    defaultBuildManifest = await fse.readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterAll(() => {
    mockDateNow.mockRestore();
    return Promise.all(
      [".next", "next.config.original.123.js"].map((file) =>
        remove(path.join(fixtureDir, file))
      )
    );
  });

  it("keeps user next.config.js intact after build", async () => {
    const nextConfigPath = path.join(fixtureDir, "next.config.js");
    expect(await pathExists(nextConfigPath)).toBe(true);
    expect(removeNewLineChars(await readFile(nextConfigPath, "utf-8"))).toEqual(
      'module.exports = { target: "serverless", trailingSlash: true };'
    );
  });

  it("cleans up temporary next.config.original.x.js generated", async () => {
    expect(
      await pathExists(path.join(fixtureDir, "next.config.original.123.js"))
    ).toBe(false);
  });

  it("sets trailingSlash to the value in next.config.js", async () => {
    const { trailingSlash } = defaultBuildManifest;
    expect(trailingSlash).toBe(true);
  });
});
