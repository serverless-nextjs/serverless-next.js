import { getNextBinary, removeNewLineChars } from "../../test-utils";
import os from "os";
import path, { join } from "path";
import Builder, { DEFAULT_LAMBDA_CODE_DIR } from "../../../src/build";
import fse, { readFile, remove, pathExists } from "fs-extra";
import {
  OriginRequestDefaultHandlerManifest,
  RoutesManifest
} from "../../../src/types";
import { v4 as uuidv4 } from "uuid";

jest.unmock("execa");

describe("With Trailing Slash Config Build", () => {
  const nextBinary = getNextBinary();
  let outputDir: string;
  let mockDateNow: jest.SpyInstance<number, []>;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let routesManifest: RoutesManifest;

  describe.each`
    fixture                                                    | expectedTrailingSlash | expectedBasePath | expectedOriginalNextConfig
    ${"fixture-next-config-as-obj"}                            | ${true}               | ${""}            | ${'module.exports = { target: "serverless", trailingSlash: true };'}
    ${"fixture-next-config-as-func"}                           | ${true}               | ${""}            | ${'module.exports = () => ({ target: "serverless", trailingSlash: true });'}
    ${"fixture-next-config-as-obj-no-trailing-slash"}          | ${false}              | ${""}            | ${'module.exports = { target: "serverless" };'}
    ${"fixture-next-config-as-func-no-trailing-slash"}         | ${false}              | ${""}            | ${'module.exports = () => ({ target: "serverless" });'}
    ${"fixture-no-next-config"}                                | ${false}              | ${""}            | ${undefined}
    ${"fixture-next-config-as-obj-basepath"}                   | ${true}               | ${"/basepath"}   | ${'module.exports = {  basePath: "/basepath",  target: "serverless",  trailingSlash: true};'}
    ${"fixture-next-config-as-obj-basepath-no-trailing-slash"} | ${false}              | ${"/basepath"}   | ${'module.exports = { basePath: "/basepath", target: "serverless" };'}
  `(
    "with fixture: $fixture",
    ({
      fixture,
      expectedTrailingSlash,
      expectedBasePath,
      expectedOriginalNextConfig
    }) => {
      const fixtureDir = path.join(__dirname, `./${fixture}`);

      beforeAll(async () => {
        mockDateNow = jest.spyOn(Date, "now").mockReturnValue(123);
        outputDir = path.join(os.tmpdir(), uuidv4(), "slsnext-test-build");
        const builder = new Builder(fixtureDir, outputDir, {
          cwd: fixtureDir,
          cmd: nextBinary,
          args: ["build"]
        });

        await builder.build(false);

        defaultBuildManifest = await fse.readJSON(
          join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
        );

        routesManifest = await fse.readJSON(
          join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/routes-manifest.json`)
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

        if (expectedOriginalNextConfig) {
          expect(await pathExists(nextConfigPath)).toBe(true);
          expect(
            removeNewLineChars(await readFile(nextConfigPath, "utf-8"))
          ).toEqual(expectedOriginalNextConfig);
        } else {
          expect(await pathExists(nextConfigPath)).toBe(false);
        }
      });

      it("cleans up temporary next.config.original.x.js generated", async () => {
        expect(
          await pathExists(path.join(fixtureDir, "next.config.original.123.js"))
        ).toBe(false);
      });

      it(`sets trailingSlash in defaultBuildManifest to ${expectedTrailingSlash}`, async () => {
        const { trailingSlash } = defaultBuildManifest;
        expect(trailingSlash).toBe(expectedTrailingSlash);
      });

      it(`default trailing slash redirects in routes-manifest.json are removed`, () => {
        // Default trailing slash redirects are removed since they are handled in non-regex solution
        expect(routesManifest.redirects).toEqual([]);
        expect(routesManifest.basePath).toEqual(expectedBasePath);
      });
    }
  );
});
