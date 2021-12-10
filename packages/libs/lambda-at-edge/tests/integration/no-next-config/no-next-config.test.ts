import { getNextBinary } from "../../test-utils";
import os from "os";
import path from "path";
import Builder from "../../../src/build";
import { remove, pathExists } from "fs-extra";

jest.unmock("execa");

describe("No Next Config Build Test", () => {
  const nextBinary = getNextBinary();
  const fixtureDir = path.join(__dirname, "./fixture");
  let mockDateNow: jest.SpyInstance<number, []>;

  beforeAll(async () => {
    const builder = new Builder(fixtureDir, os.tmpdir(), {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"]
    });

    await builder.build();
  });

  afterAll(() => {
    return Promise.all(
      [".next", "next.config.js", "next.config.original.123.js"].map((file) =>
        remove(path.join(fixtureDir, file))
      )
    );
  });

  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(123);
  });

  afterEach(() => {
    mockDateNow.mockRestore();
  });

  it("deletes temporary next.config.js created", async () => {
    expect(await pathExists(path.join(fixtureDir, "next.config.js"))).toBe(
      false
    );
  });

  it("cleans up temporary next.config.original.x.js generated", async () => {
    expect(
      await pathExists(path.join(fixtureDir, "next.config.original.123.js"))
    ).toBe(false);
  });
});
