const displayStackOutput = require("../displayStackOutput");
const logger = require("../../utils/logger");

jest.mock("../../utils/logger");

describe("displayStackOutput", () => {
  it("should not print S3 Bucket if it wasn't provisioned", () => {
    const awsInfo = {
      gatheredData: {
        outputs: []
      }
    };

    displayStackOutput(awsInfo);

    expect(logger.log).not.toBeCalled();
  });

  it("should print S3 Bucket Secure URL", () => {
    const awsInfo = {
      gatheredData: {
        outputs: [
          {
            OutputKey: "foo"
          },
          {
            OutputKey: "NextStaticAssetsS3BucketSecureURL",
            OutputValue: "https://my-bucket.s3.amazonaws.com"
          },
          {
            OutputKey: "NextStaticAssetsS3BucketWebsiteURL",
            OutputValue:
              "http://my-sls-next-app.s3-website-us-east-1.amazonaws.com"
          }
        ]
      }
    };

    displayStackOutput(awsInfo);

    expect(logger.log).toBeCalledWith(
      expect.stringContaining("https://my-bucket.s3.amazonaws.com")
    );
    expect(logger.log).toBeCalledWith(
      expect.stringContaining(
        "http://my-sls-next-app.s3-website-us-east-1.amazonaws.com"
      )
    );
  });
});
