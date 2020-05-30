import { getNextBinary } from "../../test-utils";
import os from "os";
import path from "path";
import Builder from "../../../src/build";
import { remove, pathExists } from "fs-extra";

jest.unmock("execa");

jest.setTimeout(15000);

describe("No Next Config Tests", () => {
  const nextBinary = getNextBinary();
  const fixtureDir = path.join(__dirname, "./fixture");
  let mockDateNow: jest.SpyInstance<number, []>;

  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(123);
  });

  afterEach(async () => {
    // cleanup
    await remove(path.join(fixtureDir, ".next"));
    await remove(path.join(fixtureDir, "next.config.original.123.js"));
    mockDateNow.mockRestore();
  });

  fit("builds correctly", async () => {
    const outputBuildDir = os.tmpdir();

    const builder = new Builder(fixtureDir, outputBuildDir, {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();
  });

  it("cleans up temporary next.config.js generated", async () => {
    const builder = new Builder(fixtureDir, os.tmpdir(), {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();

    const nextConfigExists = await pathExists(
      path.join(fixtureDir, "next.config.js")
    );
    const tmpNextConfigExists = await pathExists(
      path.join(fixtureDir, "next.config.original.123.js")
    );

    expect(nextConfigExists).toBe(true);
    expect(tmpNextConfigExists).toBe(false);
  });
});
