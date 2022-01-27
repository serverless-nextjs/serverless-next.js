import { createComponent } from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockCreateDistributionWithTagsPromise
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Input origin as a custom url", () => {
  let component;

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123"
      }
    });

    component = await createComponent();
  });

  it("creates distribution with custom default behavior options", async () => {
    await component.default({
      defaults: {
        minTTL: 0,
        defaultTTL: 0,
        maxTTL: 31536000,
        forward: {
          headers: ["Accept", "Accept-Language"],
          cookies: "all",
          queryString: true,
          queryStringCacheKeys: ["query"]
        },
        allowedHttpMethods: [
          "GET",
          "HEAD",
          "OPTIONS",
          "PUT",
          "POST",
          "PATCH",
          "DELETE"
        ],
        viewerProtocolPolicy: "https-only",
        smoothStreaming: true,
        compress: true,
        fieldLevelEncryptionId: "123",
        responseHeadersPolicyId: "uuid",
        realtimeLogConfigArn: "realtime_log_config_ARN"
      },
      origins: ["https://mycustomorigin.com"]
    });

    expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
  });

  it("creates distribution with custom behavior options", async () => {
    await component.default({
      defaults: {
        minTTL: 0,
        defaultTTL: 0,
        maxTTL: 31536000
      },
      origins: [
        {
          url: "https://mycustomorigin.com",
          pathPatterns: {
            "/sample/path": {
              minTTL: 0,
              defaultTTL: 0,
              maxTTL: 0,
              forward: {
                headers: "all",
                cookies: ["auth-token"],
                queryString: true
              },
              allowedHttpMethods: ["GET", "HEAD"],
              viewerProtocolPolicy: "redirect-to-https",
              compress: false,
              fieldLevelEncryptionId: "321"
            }
          }
        }
      ]
    });

    expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
  });
});
