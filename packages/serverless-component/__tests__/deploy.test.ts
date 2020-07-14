import path from "path";
import fse from "fs-extra";
import { mockS3 } from "@serverless/aws-s3";
import { mockCloudFront } from "@sls-next/aws-cloudfront";
import { mockLambda, mockLambdaPublish } from "@sls-next/aws-lambda";
import mockCreateInvalidation from "@sls-next/cloudfront";
import NextjsComponent from "../src/component";
import { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from "../src/constants";
import { cleanupFixtureDirectory } from "../src/lib/test-utils";

describe("deploy tests", () => {
  let tmpCwd;
  let componentOutputs;
  let consoleWarnSpy;

  const fixturePath = path.join(__dirname, "./fixtures/simple-app");

  beforeEach(async () => {
    const realFseRemove = fse.remove.bind({});
    jest.spyOn(fse, "remove").mockImplementation((filePath) => {
      // don't delete mocked .next/ files as they're needed for the tests and committed to source control
      if (!filePath.includes(".next" + path.sep)) {
        return realFseRemove(filePath);
      }
    });
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();

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
      id: "cloudfrontdistrib",
      url: "https://cloudfrontdistrib.amazonaws.com"
    });

    const component = new NextjsComponent();
    component.context.credentials = {
      aws: {
        accessKeyId: "123",
        secretAccessKey: "456"
      }
    };

    await component.build();

    componentOutputs = await component.deploy();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    fse.remove.mockRestore();
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
        runtime: "nodejs12.x",
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
        runtime: "nodejs12.x",
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
          },
          compress: true
        },
        origins: [
          {
            url: "http://bucket-xyz.s3.us-east-1.amazonaws.com",
            private: true,
            pathPatterns: {
              "_next/static/*": {
                ttl: 86400,
                forward: {
                  headers: "none",
                  cookies: "none",
                  queryString: false
                }
              },
              "_next/data/*": {
                ttl: 0,
                allowedHttpMethods: ["HEAD", "GET"],
                "lambda@edge": {
                  "origin-request":
                    "arn:aws:lambda:us-east-1:123456789012:function:default-cachebehavior-func:v1"
                }
              },
              "static/*": {
                ttl: 86400,
                forward: {
                  headers: "none",
                  cookies: "none",
                  queryString: false
                }
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

    it("invalidates distribution cache", () => {
      expect(mockCreateInvalidation).toBeCalledWith({
        credentials: {
          accessKeyId: "123",
          secretAccessKey: "456"
        },
        distributionId: "cloudfrontdistrib"
      });
    });
  });
});
