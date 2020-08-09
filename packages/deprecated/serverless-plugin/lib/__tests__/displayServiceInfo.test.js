const displayServiceInfo = require("../displayServiceInfo");

const serviceInfo = (additionalOutputs) => ({
  gatheredData: {
    outputs: [
      // there should always be one API Gateway
      {
        OutputKey: "ServiceEndpoint",
        OutputValue: "https://xyz.execute-api.eu-west-1.amazonaws.com"
      },
      ...additionalOutputs
    ]
  }
});

describe("displayServiceInfo", () => {
  beforeEach(() => {
    console.log = jest.fn();
  });

  it("prints info header", () => {
    displayServiceInfo(serviceInfo([]));

    expect(console.log).toBeCalledWith(
      expect.stringContaining("Nextjs Application Info")
    );
  });

  it("prints application URL using API Gateway if no Cloudfront distribution provisioned", () => {
    displayServiceInfo(serviceInfo([]));

    expect(console.log).toBeCalledWith(
      expect.stringContaining("https://xyz.execute-api.eu-west-1.amazonaws.com")
    );
  });

  it("prints application URL using Cloudfront distribution instead of API Gateway", () => {
    displayServiceInfo(
      serviceInfo([
        {
          OutputKey: "NextjsCloudFrontURL",
          OutputValue: "https://distr.s3.amazonaws.com"
        }
      ])
    );

    expect(console.log).toBeCalledWith(
      expect.stringContaining("https://distr.s3.amazonaws.com")
    );
    expect(console.log).not.toBeCalledWith(
      expect.stringContaining("https://xyz.execute-api.eu-west-1.amazonaws.com")
    );
  });

  it("prints S3 Bucket Secure URL", () => {
    displayServiceInfo(
      serviceInfo([
        {
          OutputKey: "NextStaticAssetsS3BucketSecureURL",
          OutputValue: "https://my-bucket.s3.amazonaws.com"
        }
      ])
    );

    expect(console.log).toBeCalledWith(
      expect.stringContaining("https://my-bucket.s3.amazonaws.com")
    );
  });
});
