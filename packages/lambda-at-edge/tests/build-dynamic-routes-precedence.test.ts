import { join } from "path";
import fse, { readJSON } from "fs-extra";
import execa from "execa";
import Builder from "../src/build";
import { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from "../src/build";
import { cleanupDir } from "./test-utils";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest
} from "../src/types";

jest.mock("execa");

describe("Dynamic Routes Precedence", () => {
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let apiBuildManifest: OriginRequestApiHandlerManifest;
  let fseRemoveSpy: jest.SpyInstance;

  const fixturePath = join(__dirname, "./fixtures/dynamic-routes-precedence");
  const outputDir = join(fixturePath, ".test_sls_next_output");

  beforeEach(async () => {
    const mockExeca = execa as jest.Mock;
    mockExeca.mockResolvedValueOnce();
    fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
      return;
    });

    const builder = new Builder(fixturePath, outputDir);
    await builder.build();

    defaultBuildManifest = await readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );

    apiBuildManifest = await readJSON(
      join(outputDir, `${API_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterEach(() => {
    fseRemoveSpy.mockRestore();
    return cleanupDir(outputDir);
  });

  it("adds dynamic page routes to the manifest in correct order of precedence", async () => {
    expect.assertions(1);

    const {
      pages: {
        ssr: { dynamic }
      }
    } = defaultBuildManifest;

    const routes = Object.keys(dynamic);
    expect(routes).toEqual(["/customers/:customer", "/:blog/:id"]);
  });

  it("adds dynamic api routes to the manifest in correct order of precedence", async () => {
    expect.assertions(1);

    const {
      apis: { dynamic }
    } = apiBuildManifest;

    const routes = Object.keys(dynamic);
    expect(routes).toEqual(["/api/customers/:customer", "/api/:blog/:id"]);
  });
});
