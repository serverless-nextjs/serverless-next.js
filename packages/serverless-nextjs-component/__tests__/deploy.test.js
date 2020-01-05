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

describe("deploy tests", () => {
  let tmpCwd;
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

    await component.build();

    componentOutputs = await component.deploy();

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
    expect(componentOutputs.appUrl).toEqual(
      "https://cloudfrontdistrib.amazonaws.com"
    );
  });

  it("outputs S3 bucket name", () => {
    expect(componentOutputs.bucketName).toEqual("bucket-xyz");
  });

  describe("cloudfront", () => {
    it("provisions default lambda", () => {
      expect(mockLambda).toBeCalledWith({
        description: expect.any(String),
        handler: "index.handler",
        code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
        memory: 512,
        timeout: 10,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn:
              "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
          }
        }
      });
    });

    it("provisions api lambda", () => {
      expect(mockLambda).toBeCalledWith({
        description: expect.any(String),
        handler: "index.handler",
        code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
        memory: 512,
        timeout: 10,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn:
              "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
          }
        }
      });
    });

    it("creates distribution", () => {
      expect(mockCloudFront).toBeCalledWith({
        defaults: {
          allowedHttpMethods: expect.any(Array),
          forward: {
            queryString: true,
            cookies: "all"
          },
          ttl: 0,
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
                ttl: 0,
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
