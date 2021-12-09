import { createComponent, assertCDWTHasCacheBehavior } from "../test-utils";

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

  it("creates distribution with lambda associations for each event type", async () => {
    await component.default({
      origins: [
        {
          url: "https://exampleorigin.com",
          pathPatterns: {
            "/some/path": {
              minTTL: 10,
              defaultTTL: 10,
              maxTTL: 10,
              "lambda@edge": {
                "viewer-request":
                  "arn:aws:lambda:us-east-1:123:function:viewerRequestFunction",
                "origin-request":
                  "arn:aws:lambda:us-east-1:123:function:originRequestFunction",
                "origin-response":
                  "arn:aws:lambda:us-east-1:123:function:originResponseFunction",
                "viewer-response":
                  "arn:aws:lambda:us-east-1:123:function:viewerResponseFunction"
              }
            }
          }
        }
      ]
    });

    assertCDWTHasCacheBehavior(mockCreateDistributionWithTags, {
      PathPattern: "/some/path",
      LambdaFunctionAssociations: {
        Quantity: 4,
        Items: [
          {
            EventType: "viewer-request",
            LambdaFunctionARN:
              "arn:aws:lambda:us-east-1:123:function:viewerRequestFunction",
            IncludeBody: true
          },
          {
            EventType: "origin-request",
            LambdaFunctionARN:
              "arn:aws:lambda:us-east-1:123:function:originRequestFunction",
            IncludeBody: true
          },
          {
            EventType: "origin-response",
            LambdaFunctionARN:
              "arn:aws:lambda:us-east-1:123:function:originResponseFunction"
          },
          {
            EventType: "viewer-response",
            LambdaFunctionARN:
              "arn:aws:lambda:us-east-1:123:function:viewerResponseFunction"
          }
        ]
      }
    });

    expect(mockCreateDistributionWithTags.mock.calls[0][0]).toMatchSnapshot();
  });

  it("throws error when event type provided is not valid", async () => {
    expect.assertions(1);

    try {
      await component.default({
        origins: [
          {
            url: "https://exampleorigin.com",
            pathPatterns: {
              "/some/path": {
                minTTL: 10,
                defaultTTL: 10,
                maxTTL: 10,
                "lambda@edge": {
                  "invalid-eventtype":
                    "arn:aws:lambda:us-east-1:123:function:viewerRequestFunction"
                }
              }
            }
          }
        ]
      });
    } catch (err) {
      expect(err.message).toEqual(
        '"invalid-eventtype" is not a valid lambda trigger. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-cloudfront-trigger-events.html for valid event types.'
      );
    }
  });
});
