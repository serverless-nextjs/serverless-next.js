import { getNextBinary } from "../../test-utils";
import os from "os";
import path from "path";
import Builder from "../../../src/build";
import { remove, pathExists } from "fs-extra";

jest.unmock("execa");

jest.setTimeout(15000);

describe("No Next Config Tests", () => {
  const fixtureDir = path.join(__dirname, "./fixture");

  afterEach(async () => {
    await remove(path.join(fixtureDir, ".next"));
  });

  it("builds correctly", async () => {
    const nextBinary = getNextBinary();
    const outputBuildDir = os.tmpdir();

    const builder = new Builder(fixtureDir, outputBuildDir, {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();
  });

  it.skip("cleans up temporary next.config.js generated", async () => {
    const nextConfigExists = await pathExists(
      path.join(fixtureDir, "next.config.js")
    );
    expect(nextConfigExists).toBe(false);
  });
});
