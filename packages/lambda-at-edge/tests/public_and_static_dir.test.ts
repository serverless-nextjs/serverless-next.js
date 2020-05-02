import execa from "execa";
import Builder from "../src/build";
import { readJSON } from "fs-extra";
import { join } from "path";
import { DEFAULT_LAMBDA_CODE_DIR } from "../src/build";
import { cleanupDir } from "./test-utils";
import { OriginRequestDefaultHandlerManifest } from "../src/types";

jest.mock("execa");

describe("When public and static directories do not exist", () => {
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;

  const fixturePath = join(
    __dirname,
    "./fixtures/app-with-no-static-or-public-dir"
  );
  const outputDir = join(fixturePath, ".test_sls_next_output");

  beforeAll(async () => {
    const mockExeca = execa as jest.Mock;
    mockExeca.mockResolvedValueOnce();

    const builder = new Builder(fixturePath, outputDir);
    await builder.build();

    defaultBuildManifest = await readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterAll(() => cleanupDir(outputDir));

  it("does not put any public files in the build manifest", async () => {
    expect(defaultBuildManifest.publicFiles).toEqual({});
  });
});
