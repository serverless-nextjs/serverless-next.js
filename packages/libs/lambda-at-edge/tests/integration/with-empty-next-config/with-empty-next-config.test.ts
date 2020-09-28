import { getNextBinary, removeNewLineChars } from "../../test-utils";
import os from "os";
import path, { join } from "path";
import Builder, { DEFAULT_LAMBDA_CODE_DIR } from "../../../src/build";
import fse, { readFile, remove, pathExists } from "fs-extra";
import { RoutesManifest } from "types";

jest.unmock("execa");

describe("With Empty Next Config Build", () => {
  const nextBinary = getNextBinary();
  const fixtureDir = path.join(__dirname, "./fixture");
  let mockDateNow: jest.SpyInstance<number, []>;

  beforeAll(async () => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(123);
    const builder = new Builder(fixtureDir, os.tmpdir(), {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();
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
      "module.exports = () => ({});"
    );
  });

  it("cleans up temporary next.config.original.x.js generated", async () => {
    expect(
      await pathExists(path.join(fixtureDir, "next.config.original.123.js"))
    ).toBe(false);
  });

  it(`default redirects in routes-manifest.json are removed`, () => {
    expect(routesManifest.redirects).toEqual([]);
  });
});
