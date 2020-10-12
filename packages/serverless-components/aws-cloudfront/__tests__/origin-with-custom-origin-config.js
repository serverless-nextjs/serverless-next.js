const {
  createComponent,
  assertHasCustomOriginConfig
} = require("../test-utils");

const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockCreateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin with custom origin config", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "xyz"
      }
    });

    component = await createComponent();
  });

  it("creates distribution with custom origin config", async () => {
    await component.default({
      origins: [
        {
          url: "http://exampleorigin.com",
          protocolPolicy: "http-only"
        }
      ]
    });

    assertHasCustomOriginConfig(mockCreateDistribution, {
      OriginProtocolPolicy: "http-only"
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
      origins: [
        {
          url: "https://exampleorigin.com",
          protocolPolicy: "http-only"
        }
      ]
    });

    await component.default({
      origins: [
        {
          url: "https://exampleorigin.com",
          protocolPolicy: "https-only"
        }
      ]
    });

    assertHasCustomOriginConfig(mockUpdateDistribution, {
      OriginProtocolPolicy: "https-only"
    });

    expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });
});
