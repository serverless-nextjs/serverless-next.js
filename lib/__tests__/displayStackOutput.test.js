const displayStackOutput = require("../displayStackOutput");

describe("displayStackOutput", () => {
  it("should print S3 Bucket Secure URL", () => {
    const consoleLog = jest.fn();
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

    displayStackOutput({
      consoleLog,
      awsInfo
    });

    expect(consoleLog).toBeCalledWith(
      expect.stringContaining("Nextjs static assets bucket details:")
    );
    expect(consoleLog).toBeCalledWith(
      expect.stringContaining("https://my-bucket.s3.amazonaws.com")
    );
    expect(consoleLog).toBeCalledWith(
      expect.stringContaining(
        "http://my-sls-next-app.s3-website-us-east-1.amazonaws.com"
      )
    );
  });
});
