const path = require("path");
const fse = require("fs-extra");
const execa = require("execa");
const NextjsComponent = require("../serverless");

const {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} = require("../constants");
const { cleanupFixtureDirectory } = require("../lib/test-utils");

jest.mock("execa");

describe("Dynamic Routes Precedence", () => {
  let tmpCwd;
  let pagesBuildManifest;

  const fixturePath = path.join(
    __dirname,
    "./fixtures/dynamic-routes-precedence"
  );

  beforeEach(async () => {
    execa.mockResolvedValueOnce();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    const component = new NextjsComponent();
    componentOutputs = await component.build();
  });

  afterEach(() => {
    process.chdir(tmpCwd);
  });

  afterAll(cleanupFixtureDirectory(fixturePath));

  it("adds dynamic page routes to the manifest in correct order of precedence", async () => {
    expect.assertions(1);

    pagesBuildManifest = await fse.readJSON(
      path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );

    const {
      pages: {
        ssr: { dynamic }
      }
    } = pagesBuildManifest;

    const routes = Object.keys(dynamic);
    expect(routes).toEqual(["/customers/:customer", "/:blog/:id"]);
  });

  it("adds dynamic api routes to the manifest in correct order of precedence", async () => {
    expect.assertions(1);

    apiBuildManifest = await fse.readJSON(
      path.join(fixturePath, `${API_LAMBDA_CODE_DIR}/manifest.json`)
    );

    const {
      apis: { dynamic }
    } = apiBuildManifest;

    const routes = Object.keys(dynamic);
    expect(routes).toEqual(["/api/customers/:customer", "/api/:blog/:id"]);
  });
});
