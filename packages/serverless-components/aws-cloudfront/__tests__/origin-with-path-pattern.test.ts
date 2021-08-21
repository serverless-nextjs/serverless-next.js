import {
  createComponent,
  assertHasCacheBehavior,
  assertHasOrigin,
  assertCDWTHasCacheBehavior,
  assertCDWTHasOrigin
} from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockUpdateDistribution,
  mockCreateDistributionWithTagsPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin with path pattern", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
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
              minTTL: 10,
              defaultTTL: 10,
              maxTTL: 10,
              allowedHttpMethods: ["GET", "HEAD", "POST"]
            }
          }
        }
      ]
    });

    assertCDWTHasOrigin(mockCreateDistributionWithTags, {
      Id: "exampleorigin.com",
      DomainName: "exampleorigin.com"
    });

    assertCDWTHasCacheBehavior(mockCreateDistributionWithTags, {
      PathPattern: "/some/path",
      MinTTL: 10,
      TargetOriginId: "exampleorigin.com"
    });

    expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
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
              minTTL: 10,
              defaultTTL: 10,
              maxTTL: 10
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
              minTTL: 10,
              defaultTTL: 10,
              maxTTL: 10
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
