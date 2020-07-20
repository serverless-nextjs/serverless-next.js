const { createComponent, assertHasOrigin } = require("../test-utils");

const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockCreateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin as a custom url", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123"
      }
    });

    component = await createComponent();
  });

  it("creates distribution with custom url origin and sets defaults", async () => {
    await component.default({
      defaults: {
        allowedHttpMethods: [
          "HEAD",
          "DELETE",
          "POST",
          "GET",
          "OPTIONS",
          "PUT",
          "PATCH"
        ],
        ttl: 10,
        "lambda@edge": {
          "origin-request":
            "arn:aws:lambda:us-east-1:123:function:originRequestFunction"
        }
      },
      origins: ["https://mycustomorigin.com"]
    });

    assertHasOrigin(mockCreateDistribution, {
      Id: "mycustomorigin.com",
      DomainName: "mycustomorigin.com",
      CustomOriginConfig: {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: "https-only",
        OriginSslProtocols: {
          Quantity: 1,
          Items: ["TLSv1.2"]
        },
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 5
      },
      CustomHeaders: {
        Quantity: 0,
        Items: []
      },
      OriginPath: ""
    });
    expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });

  it("updates distribution", async () => {
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Origins: {
          Quantity: 0,
          Items: []
        }
      }
    });
    mockUpdateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "xyz"
      }
    });

    await component.default({
      origins: ["https://mycustomorigin.com"]
    });

    await component.default({
      origins: ["https://mycustomoriginupdated.com"]
    });

    assertHasOrigin(mockUpdateDistribution, {
      Id: "mycustomoriginupdated.com",
      DomainName: "mycustomoriginupdated.com",
      CustomOriginConfig: {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: "https-only",
        OriginSslProtocols: {
          Quantity: 1,
          Items: ["TLSv1.2"]
        },
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 5
      },
      CustomHeaders: {
        Quantity: 0,
        Items: []
      },
      OriginPath: ""
    });
    expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });
});
