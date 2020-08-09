const {
  createComponent,
  assertHasCacheBehavior,
  assertHasOrigin
} = require("../test-utils");

const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockCreateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin with path pattern", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "xyz"
      }
    });

    component = await createComponent();
  });

  it("creates distribution with custom url origin", async () => {
    await component.default({
      origins: [
        {
          url: "https://exampleorigin.com",
          pathPatterns: {
            "/some/path": {
              ttl: 10,
              allowedHttpMethods: ["GET", "HEAD", "POST"]
            }
          }
        }
      ]
    });

    assertHasOrigin(mockCreateDistribution, {
      Id: "exampleorigin.com",
      DomainName: "exampleorigin.com"
    });

    assertHasCacheBehavior(mockCreateDistribution, {
      PathPattern: "/some/path",
      MinTTL: 10,
      TargetOriginId: "exampleorigin.com"
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
          pathPatterns: {
            "/some/path": {
              ttl: 10
            }
          }
        }
      ]
    });

    await component.default({
      origins: [
        {
          url: "https://exampleorigin.com",
          pathPatterns: {
            "/some/other/path": {
              ttl: 10
            }
          }
        }
      ]
    });

    assertHasOrigin(mockUpdateDistribution, {
      Id: "exampleorigin.com",
      DomainName: "exampleorigin.com"
    });

    assertHasCacheBehavior(mockUpdateDistribution, {
      PathPattern: "/some/other/path",
      MinTTL: 10,
      TargetOriginId: "exampleorigin.com"
    });

    expect(mockUpdateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });
});
