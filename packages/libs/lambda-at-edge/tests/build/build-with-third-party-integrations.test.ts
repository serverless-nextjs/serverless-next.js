import { join } from "path";
import fse from "fs-extra";
import execa from "execa";
import Builder, {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR,
  IMAGE_LAMBDA_CODE_DIR,
  REGENERATION_LAMBDA_CODE_DIR
} from "../../src/build";
import { cleanupDir } from "../test-utils";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest,
  OriginRequestImageHandlerManifest
} from "../../src/types";

jest.mock("execa");

describe("Builder Tests (with third party integrations)", () => {
  let fseRemoveSpy: jest.SpyInstance;
  let fseEmptyDirSpy: jest.SpyInstance;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let apiBuildManifest: OriginRequestApiHandlerManifest;
  let imageBuildManifest: OriginRequestImageHandlerManifest;

  const fixturePath = join(
    __dirname,
    "./simple-app-fixture-third-party-integrations"
  );
  const outputDir = join(fixturePath, ".test_sls_next_output");

  describe("Regular build", () => {
    beforeEach(async () => {
      const mockExeca = execa as jest.Mock;
      mockExeca.mockResolvedValueOnce();

      fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
        return;
      });
      fseEmptyDirSpy = jest.spyOn(fse, "emptyDir");

      const builder = new Builder(fixturePath, outputDir, {});
      await builder.build();

      defaultBuildManifest = await fse.readJSON(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
      );

      apiBuildManifest = await fse.readJSON(
        join(outputDir, `${API_LAMBDA_CODE_DIR}/manifest.json`)
      );

      imageBuildManifest = await fse.readJSON(
        join(outputDir, `${IMAGE_LAMBDA_CODE_DIR}/manifest.json`)
      );
    });

    afterEach(() => {
      fseEmptyDirSpy.mockRestore();
      fseRemoveSpy.mockRestore();
      return cleanupDir(outputDir);
    });

    describe("Default Handler Third Party Files", () => {
      it("next-i18next files are copied", async () => {
        expect(
          await fse.pathExists(
            join(
              outputDir,
              `${DEFAULT_LAMBDA_CODE_DIR}`,
              "next-i18next.config.js"
            )
          )
        ).toBe(true);

        const localesFiles = await fse.readdir(
          join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}`, "public", "locales")
        );

        expect(localesFiles).toEqual(expect.arrayContaining(["de", "en"]));
      });
    });

    describe("Regeneration Handler Third Party Files", () => {
      it("next-i18next files are copied", async () => {
        expect(
          await fse.pathExists(
            join(
              outputDir,
              `${REGENERATION_LAMBDA_CODE_DIR}`,
              "next-i18next.config.js"
            )
          )
        ).toBe(true);

        const localesFiles = await fse.readdir(
          join(
            outputDir,
            `${REGENERATION_LAMBDA_CODE_DIR}`,
            "public",
            "locales"
          )
        );

        expect(localesFiles).toEqual(expect.arrayContaining(["de", "en"]));
      });
    });
  });
});
