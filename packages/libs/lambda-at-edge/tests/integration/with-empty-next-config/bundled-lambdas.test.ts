import { remove, pathExists } from "fs-extra";
import path from "path";
import { getNextBinary } from "../../test-utils";
import os from "os";
import Builder from "../../../src/build";

jest.unmock("execa");

describe("Next.js 12 bundled lambdas", () => {
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
      bundledLambdas: true
    });

    await builder.build();
  });

  afterAll(() => {
    return Promise.all(
      [".next"].map((file) => remove(path.join(fixtureDir, file)))
    );
  });

  it("does not copy node_modules to default lambda artefact", async () => {
    const exists = await pathExists(
      path.join(outputDir, "default-lambda/node_modules")
    );
    expect(exists).toBe(false);
  });

  it("copies bundle.js to default lambda artefact", async () => {
    const exists = await pathExists(
      path.join(outputDir, "default-lambda/bundle.js")
    );

    expect(exists).toBe(true);
  });
});
