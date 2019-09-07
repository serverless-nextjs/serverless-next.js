const path = require("path");
const NextjsComponent = require("../serverless");
const { mockS3, mockS3Upload } = require("@serverless/aws-s3");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");

jest.mock("execa");

describe("Assets Upload Tests", () => {
  beforeEach(() => {
    mockS3.mockResolvedValue({
      name: "bucket-xyz"
    });
    mockLambda.mockResolvedValueOnce({
      arn: "arn:aws:lambda:us-east-1:123456789012:function:my-func"
    });
    mockLambdaPublish.mockResolvedValueOnce({
      version: "v1"
    });
    mockCloudFront.mockResolvedValueOnce({
      url: "https://cloudfrontdistrib.amazonaws.com"
    });
  });

  describe("When public and static directories exist", () => {
    beforeEach(async () => {
      const fixturePath = path.join(__dirname, "./fixtures/simple-app");
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      const component = new NextjsComponent();
      await component.default();

      process.chdir(tmpCwd);
    });

    it("uploads client build assets", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./.next/static",
        keyPrefix: "_next/static"
      });
    });

    it("uploads user static directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./static",
        keyPrefix: "static"
      });
    });

    it("uploads user public directory", () => {
      expect(mockS3Upload).toBeCalledWith({
        dir: "./public",
        keyPrefix: "public"
      });
    });

    it("uploads html pages to S3", () => {
      ["terms.html", "about.html"].forEach(page => {
        expect(mockS3Upload).toBeCalledWith({
          file: `./.next/serverless/pages/${page}`,
          key: `static-pages/${page}`
        });
      });
    });
  });
});
