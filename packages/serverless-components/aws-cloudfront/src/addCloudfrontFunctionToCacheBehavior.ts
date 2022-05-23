const validCloudfrontFunctionsTriggers = ["viewer-request", "viewer-response"];

export type CacheBehavior = {
  FunctionAssociations: {
    Quantity: number;
    Items: {
      FunctionARN: string;
      EventType: string;
    }[];
  };
};

// adds cloudfront functions to cache behavior passed
export default (
  cacheBehavior: CacheBehavior,
  cloudfrontFunctionsConfig = {}
): void => {
  Object.keys(cloudfrontFunctionsConfig).forEach((eventType) => {
    if (!validCloudfrontFunctionsTriggers.includes(eventType)) {
      throw new Error(
        `"${eventType}" is not a valid cloudfront functions trigger. See https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-functionassociation.html for valid event types.`
      );
    }

    cacheBehavior.FunctionAssociations.Quantity =
      cacheBehavior.FunctionAssociations.Quantity + 1;
    cacheBehavior.FunctionAssociations.Items.push({
      FunctionARN:
        cloudfrontFunctionsConfig[
          eventType === "viewer-request" ? "viewer-request" : "viewer-response"
        ],
      EventType: eventType
    });
  });
};
