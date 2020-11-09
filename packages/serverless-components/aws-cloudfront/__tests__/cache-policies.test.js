const { createComponent, assertHasCacheBehavior } = require("../test-utils");

const {
  mockCreateDistribution,
  mockCreateDistributionPromise,
  mockCreateCachePolicyPromise,
  mockCreateCachePolicy
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Cache Policies", () => {
  let component;
  let testCachePolicy;
  let testHeaders, testCookies, testQueryStrings;

  beforeEach(async () => {
    testHeaders = ["header1"];
    testCookies = ["cookie1"];
    testQueryStrings = ["queryString1"];
    testCachePolicy = {
      minTTL: 10,
      name: "cachePolicyOne",
      comment: "comment",
      defaultTTL: 10,
      maxTTL: 100,
      parametersInCacheKeyAndForwardedToOrigin: {
        cookiesConfig: {
          cookieBehavior: "whitelist",
          cookies: testCookies
        },
        headersConfig: {
          headerBehavior: "whitelist",
          headers: testHeaders
        },
        queryStringsConfig: {
          queryStringBehavior: "whitelist",
          queryStrings: testQueryStrings
        },
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true
      }
    };

    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123"
      }
    });
    mockCreateCachePolicyPromise.mockResolvedValueOnce({
      CachePolicy: {
        Id: "TestCachePolicyId"
      }
    });

    component = await createComponent();

    await component.default({
      origins: [
        {
          url: "https://exampleorigin.com",
          pathPatterns: {
            "/some/path": {
              cachePolicy: testCachePolicy
            }
          }
        }
      ]
    });
  });

  it("creates the cache policy before the behavior", () => {
    expect(mockCreateCachePolicy.mock.calls[0][0]).toMatchSnapshot();
  });

  it("attaches cache policy to cache behavior", async () => {
    assertHasCacheBehavior(mockCreateDistribution, {
      PathPattern: "/some/path",
      CachePolicyId: "TestCachePolicyId"
    });

    expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });
});
