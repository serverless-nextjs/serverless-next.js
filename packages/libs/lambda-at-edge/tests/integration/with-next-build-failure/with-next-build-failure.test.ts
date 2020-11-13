import { getNextBinary, removeNewLineChars } from "../../test-utils";
import os from "os";
import path from "path";
import Builder from "../../../src/build";
import { readFile, remove, pathExists } from "fs-extra";

jest.unmock("execa");

describe("With Next Build Failure", () => {
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

    try {
      await builder.build();
    } catch (e) {
      // ignore error, we expect next build to fail
      // what matters is the assertions below
    }
  });

  afterAll(() => {
    mockDateNow.mockRestore();
    return Promise.all(
      [".next", "next.config.original.123.js"].map((file) =>
        remove(path.join(fixtureDir, file))
      )
    );
  });

  it("keeps user next.config.js intact after build failure", async () => {
    const nextConfigPath = path.join(fixtureDir, "next.config.js");

    expect(await pathExists(nextConfigPath)).toBe(true);
    expect(removeNewLineChars(await readFile(nextConfigPath, "utf-8"))).toEqual(
      "module.exports = {};"
    );
  });

  it("cleans up temporary next.config.original.x.js generated", async () => {
    expect(
      await pathExists(path.join(fixtureDir, "next.config.original.123.js"))
    ).toBe(false);
  });
});
