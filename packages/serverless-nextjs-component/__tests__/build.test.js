const path = require("path");
const fse = require("fs-extra");
const execa = require("execa");
const NextjsComponent = require("../serverless");
const { mockS3 } = require("@serverless/aws-s3");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");
const {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR
} = require("../constants");
const { cleanupFixtureDirectory } = require("../lib/test-utils");

jest.mock("execa");

describe("build tests", () => {
  let tmpCwd;
  let defaultBuildManifest;
  let componentOutputs;

  const fixturePath = path.join(__dirname, "./fixtures/simple-app");

  beforeEach(async () => {
    execa.mockResolvedValueOnce();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    mockS3.mockResolvedValue({
      name: "bucket-xyz"
    });
    mockLambda.mockResolvedValueOnce({
      arn:
        "arn:aws:lambda:us-east-1:123456789012:function:api-cachebehavior-func"
    });
    mockLambda.mockResolvedValueOnce({
      arn:
        "arn:aws:lambda:us-east-1:123456789012:function:default-cachebehavior-func"
    });
    mockLambdaPublish.mockResolvedValue({
      version: "v1"
    });
    mockCloudFront.mockResolvedValueOnce({
      url: "https://cloudfrontdistrib.amazonaws.com"
    });

    const component = new NextjsComponent();

    componentOutputs = await component.default();

    defaultBuildManifest = await fse.readJSON(
      path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );

    apiBuildManifest = await fse.readJSON(
      path.join(fixturePath, `${API_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterEach(() => {
    process.chdir(tmpCwd);
  });

  afterAll(cleanupFixtureDirectory(fixturePath));

  it("outputs next application url from cloudfront", () => {
    expect(componentOutputs.appUrl).toEqual("https://cloudfrontdistrib.amazonaws.com");
  });

  it("outputs S3 bucket name", () => {
    expect(componentOutputs.bucketName).toEqual("bucket-xyz");
  });

  describe("Default build manifest", () => {
    it("adds full manifest", () => {
      const {
        publicFiles,
        pages: {
          ssr: { dynamic, nonDynamic },
          html
        },
        cloudFrontOrigins: { staticOrigin }
      } = defaultBuildManifest;

      expect(dynamic).toEqual({
        "/:root": {
          file: "pages/[root].js",
          regex: expect.any(String)
        },
        "/blog/:id": {
          file: "pages/blog/[id].js",
          regex: expect.any(String)
        },
        "/customers/:customer": {
          file: "pages/customers/[customer].js",
          regex: expect.any(String)
        },
        "/customers/:customer/:post": {
          file: "pages/customers/[customer]/[post].js",
          regex: expect.any(String)
        },
        "/customers/:customer/profile": {
          file: "pages/customers/[customer]/profile.js",
          regex: expect.any(String)
        }
      });

      expect(nonDynamic).toEqual({
        "/customers/new": "pages/customers/new.js",
        "/": "pages/index.js",
        "/_app": "pages/_app.js",
        "/_document": "pages/_document.js",
        "/404": "pages/404.js"
      });

      expect(html).toEqual({
        "/terms": "pages/terms.html",
        "/about": "pages/about.html"
      });

      expect(publicFiles).toEqual({
        "/favicon.ico": "favicon.ico",
        "/sw.js": "sw.js"
      });
      expect(staticOrigin).toEqual({
        domainName: "bucket-xyz.s3.amazonaws.com"
      });
    });
  });

  describe("API build manifest", () => {
    it("adds full api manifest", () => {
      const {
        apis: { dynamic, nonDynamic }
      } = apiBuildManifest;

      expect(nonDynamic).toEqual({
        "/api/customers": "pages/api/customers.js",
        "/api/customers/new": "pages/api/customers/new.js"
      });
      expect(dynamic).toEqual({
        "/api/customers/:id": {
          file: "pages/api/customers/[id].js",
          regex: expect.any(String)
        }
      });
    });
  });

  describe("Default lambda build files", () => {
    it("copies build files", async () => {
      expect.assertions(4);

      const files = await fse.readdir(
        path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}`)
      );
      const pages = await fse.readdir(
        path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/pages`)
      );
      const customerPages = await fse.readdir(
        path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/pages/customers`)
      );
      const apiDirExists = await fse.exists(
        path.join(fixturePath, `${DEFAULT_LAMBDA_CODE_DIR}/pages/api`)
      );

      expect(files).toEqual([
        "index.js",
        "manifest.json",
        "next-aws-cloudfront.js",
        "pages"
      ]);

      // api pages should not be included in the default lambda
      expect(apiDirExists).toEqual(false);

      // html pages should not be included in the default lambda
      expect(pages).toEqual(["_error.js", "blog.js", "customers"]);
      expect(customerPages).toEqual(["[post].js"]);
    });
  });

  describe("API lambda build files", () => {
    it("copies build files", async () => {
      expect.assertions(2);

      const files = await fse.readdir(
        path.join(fixturePath, `${API_LAMBDA_CODE_DIR}`)
      );
      const pages = await fse.readdir(
        path.join(fixturePath, `${API_LAMBDA_CODE_DIR}/pages`)
      );

      expect(files).toEqual([
        "index.js",
        "manifest.json",
        "next-aws-cloudfront.js",
        "pages"
      ]);
      expect(pages).toEqual(["_error.js", "api"]);
    });
  });

  describe("cloudfront", () => {
    it("provisions default lambda", () => {
      expect(mockLambda).toBeCalledWith({
        description: expect.any(String),
        handler: "index.handler",
        code: `./${DEFAULT_LAMBDA_CODE_DIR}`,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn: "arn:aws:iam::aws:policy/AdministratorAccess"
          }
        }
      });
    });

    it("provisions api lambda", () => {
      expect(mockLambda).toBeCalledWith({
        description: expect.any(String),
        handler: "index.handler",
        code: `./${API_LAMBDA_CODE_DIR}`,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn: "arn:aws:iam::aws:policy/AdministratorAccess"
          }
        }
      });
    });

    it("creates distribution", () => {
      expect(mockCloudFront).toBeCalledWith({
        defaults: {
          allowedHttpMethods: expect.any(Array),
          ttl: 5,
          "lambda@edge": {
            "origin-request":
              "arn:aws:lambda:us-east-1:123456789012:function:default-cachebehavior-func:v1"
          }
        },
        origins: [
          {
            url: "http://bucket-xyz.s3.amazonaws.com",
            private: true,
            pathPatterns: {
              "_next/*": {
                ttl: 86400
              },
              "static/*": {
                ttl: 86400
              },
              "api/*": {
                ttl: 5,
                "lambda@edge": {
                  "origin-request":
                    "arn:aws:lambda:us-east-1:123456789012:function:api-cachebehavior-func:v1"
                },
                allowedHttpMethods: expect.any(Array)
              }
            }
          }
        ]
      });
    });
  });
});
