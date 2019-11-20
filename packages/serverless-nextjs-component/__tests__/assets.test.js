const path = require("path");
const fse = require("fs-extra");
const NextjsComponent = require("../serverless");
const { mockS3, mockS3Upload } = require("@serverless/aws-s3");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");
const { DEFAULT_LAMBDA_CODE_DIR } = require("../constants");
const { cleanupFixtureDirectory } = require("../lib/test-utils");

jest.mock("execa");

describe("Assets Tests", () => {
  beforeEach(() => {
    mockS3.mockResolvedValue({
      name: "bucket-xyz"
    });
    mockLambda.mockResolvedValue({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
    });
    mockLambdaPublish.mockResolvedValue({
      version: "v1"
    });
    mockCloudFront.mockResolvedValueOnce({
      url: "https://cloudfrontdistrib.amazonaws.com"
    });
  });

  describe("When public and static directories exist", () => {
    const fixturePath = path.join(__dirname, "./fixtures/simple-app");

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      const component = new NextjsComponent();
      await component.default();

      process.chdir(tmpCwd);
    });

    afterAll(cleanupFixtureDirectory(fixturePath));

    it("uploads client build assets", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: path.join(fixturePath, ".next/static"),
        cacheControl: "public, max-age=31536000, immutable",
        keyPrefix: "_next/static"
      });
    });

    it("uploads user static directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: path.join(fixturePath, "static"),
        keyPrefix: "static"
      });
    });

    it("uploads user public directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: path.join(fixturePath, "public"),
        keyPrefix: "public"
      });
    });

    it("uploads html pages to S3", () => {
      ["terms.html", "about.html"].forEach(page => {
        expect(mockS3Upload).toBeCalledWith({
          file: path.join(fixturePath, ".next/serverless/pages", page),
          key: `static-pages/${page}`
        });
      });
    });
  });

  describe("When public and static directories do not exist", () => {
    const fixturePath = path.join(
      __dirname,
      "./fixtures/app-with-no-static-or-public-directory"
    );

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      const component = new NextjsComponent();
      await component.default();

      process.chdir(tmpCwd);
    });

    afterAll(cleanupFixtureDirectory(fixturePath));

    it("does not upload user static directory", () => {
      expect(mockS3Upload).not.toBeCalledWith({
        dir: "./static",
        keyPrefix: "static"
      });
    });

    it("does not upload user public directory", () => {
      expect(mockS3Upload).not.toBeCalledWith({
        dir: "./public",
        keyPrefix: "public"
      });
    });

    it("does not put any public files in the build manifest", async () => {
      manifest = await fse.readJSON(
        path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
      );

      expect(manifest.publicFiles).toEqual({});
    });
  });
});
