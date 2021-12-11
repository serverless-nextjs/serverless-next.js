import { remove, readdir, pathExists, readFile } from "fs-extra";
import path from "path";
import { getNextBinary } from "../../test-utils";
import os from "os";
import Builder from "../../../src/build";

jest.unmock("execa");

describe("Next.js 12 Output File Tracing", () => {
  const nextBinary = getNextBinary();
  const fixtureDir = path.join(__dirname, "./fixture");
  let outputDir: string;

  beforeAll(async () => {
    outputDir = path.join(
      os.tmpdir(),
      new Date().getUTCMilliseconds().toString(),
      "slsnext-test-build"
    );
    console.log("outputDir:", outputDir);

    const builder = new Builder(fixtureDir, outputDir, {
      cwd: fixtureDir,
      cmd: nextBinary,
      args: ["build"],
      outputFileTracing: true
    });

    await builder.build();
  });

  afterAll(() => {
    return Promise.all(
      [".next"].map((file) => remove(path.join(fixtureDir, file)))
    );
  });

  it("copies node_modules to default lambda artefact", async () => {
    const nodeModules = await readdir(
      path.join(outputDir, "default-lambda/node_modules")
    );
    expect(nodeModules.length).toBeGreaterThan(5); // 5 is just an arbitrary number to ensure dependencies are being copied
  });

  it("copies index.html page to static assets", async () => {
    const BUILD_ID = (
      await readFile(path.join(outputDir, "assets", "BUILD_ID"))
    ).toString();

    const staticFileInOutput = await pathExists(
      path.join(outputDir, "assets", "static-pages", BUILD_ID, "index.html")
    );

    expect(staticFileInOutput).toBe(true);
  });
});
