const fse = require("fs-extra");
const execa = require("execa");
const { mockS3 } = require("@serverless/aws-s3");
const { mockLambda, mockLambdaPublish } = require("@serverless/aws-lambda");
const { mockCloudFront } = require("@serverless/aws-cloudfront");
const NextjsComponent = require("../serverless");

jest.mock("execa");
jest.mock("fs-extra");

describe("Custom environment variables", () => {
  beforeEach(async () => {
    execa.mockResolvedValueOnce();

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

    fse.readJSON.mockResolvedValue({
      "/blog/[id]": "pages/blog/[id].js",
      "/api/customers/new": "pages/api/customers/new.js"
    });

    const component = new NextjsComponent();

    await component.default({
      env: {
        MY_SECRET: "sshhh"
      }
    });
  });

  it("passes environment variables to Lambda functions provisioned", () => {
    expect(mockLambda).toBeCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("API Lambda@Edge"),
        env: {
          MY_SECRET: "sshhh"
        }
      })
    );
    expect(mockLambda).toBeCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("Default Lambda@Edge"),
        env: {
          MY_SECRET: "sshhh"
        }
      })
    );
  });
});
