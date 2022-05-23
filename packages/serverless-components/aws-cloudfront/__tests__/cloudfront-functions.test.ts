import {
  createComponent,
  assertCDWTHasFunctionAssociations
} from "../test-utils";

import {
  mockCreateDistributionWithTags,
  mockCreateDistributionWithTagsPromise
} from "../__mocks__/aws-sdk.mock";

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Configures cloudfront functions settings", () => {
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

  it("creates distribution with cloudfront functions associations for each event type", async () => {
    await component.default({
      origins,
      defaults: {
        cloudfrontFunctions: {
          "viewer-request":
            "arn:aws:cloudfront::123:function/viewerRequestFunction",
          "viewer-response":
            "arn:aws:cloudfront::123:function/viewerResponseFunction"
        }
      }
    });

    assertCDWTHasFunctionAssociations(mockCreateDistributionWithTags, {
      FunctionAssociations: {
        Quantity: 2,
        Items: [
          {
            EventType: "viewer-request",
            FunctionARN:
              "arn:aws:cloudfront::123:function/viewerRequestFunction"
          },
          {
            EventType: "viewer-response",
            FunctionARN:
              "arn:aws:cloudfront::123:function/viewerResponseFunction"
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
        origins,
        defaults: {
          cloudfrontFunctions: {
            "invalid-eventtype":
              "arn:aws:cloudfront::123:function/viewerRequestFunction"
          }
        }
      });
    } catch (err) {
      expect(err.message).toEqual(
        '"invalid-eventtype" is not a valid cloudfront functions trigger. See https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-functionassociation.html for valid event types.'
      );
    }
  });
});
