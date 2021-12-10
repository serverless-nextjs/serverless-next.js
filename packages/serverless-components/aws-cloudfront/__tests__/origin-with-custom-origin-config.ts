import {
  createComponent,
  assertHasCustomOriginConfig,
  assertCDWTHasCustomOriginConfig
} from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockUpdateDistribution,
  mockCreateDistributionWithTagsPromise,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin with custom origin config", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
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

    assertCDWTHasCustomOriginConfig(mockCreateDistributionWithTags, {
      OriginProtocolPolicy: "http-only"
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
