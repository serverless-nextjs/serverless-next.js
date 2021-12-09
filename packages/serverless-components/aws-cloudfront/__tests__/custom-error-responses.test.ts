import { createComponent } from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockCreateDistributionWithTagsPromise
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Configures custom error responses", () => {
  let component;

  // sample origins
  const origins = ["https://exampleorigin.com"];

  beforeEach(async () => {
    mockCreateDistributionWithTagsPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "distribution123"
      }
    });

    component = await createComponent();
  });

  it("creates distribution with custom error responses", async () => {
    await component.default({
      origins,
      errorPages: [
        {
          code: 404,
          path: "/404.html"
        }
      ]
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            CustomErrorResponses: expect.objectContaining({
              Quantity: 1,
              Items: expect.arrayContaining([
                {
                  ErrorCode: "404",
                  ErrorCachingMinTTL: "10",
                  ResponseCode: "404",
                  ResponsePagePath: "/404.html"
                }
              ])
            })
          })
        })
      })
    );
  });

  it("clears custom error responses when not configured", async () => {
    await component.default({
      origins
    });

    expect(mockCreateDistributionWithTags).toBeCalledWith(
      expect.objectContaining({
        DistributionConfigWithTags: expect.objectContaining({
          DistributionConfig: expect.objectContaining({
            CustomErrorResponses: expect.objectContaining({
              Quantity: 0,
              Items: []
            })
          })
        })
      })
    );
  });

  it("only allows certain error codes", async () => {
    const failing = async (code, responseCode) => {
      await component.default({
        origins,
        errorPages: [
          {
            code,
            responseCode,
            path: "/404.html"
          }
        ]
      });
    };
    await expect(failing(401, undefined)).rejects.toThrow(
      'CloudFront error code "401" is not supported'
    );
    await expect(failing(400, 401)).rejects.toThrow(
      'CloudFront error code "401" is not supported'
    );
  });
});
