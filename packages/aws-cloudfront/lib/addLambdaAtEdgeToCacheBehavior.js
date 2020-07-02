const validLambdaTriggers = [
  "viewer-request",
  "origin-request",
  "origin-response",
  "viewer-response"
];

// adds lambda@edge to cache behavior passed
module.exports = (cacheBehavior, lambdaAtEdgeConfig = {}) => {
  Object.keys(lambdaAtEdgeConfig).forEach((eventType) => {
    if (!validLambdaTriggers.includes(eventType)) {
      throw new Error(
        `"${eventType}" is not a valid lambda trigger. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-cloudfront-trigger-events.html for valid event types.`
      );
    }

    cacheBehavior.LambdaFunctionAssociations.Quantity =
      cacheBehavior.LambdaFunctionAssociations.Quantity + 1;
    cacheBehavior.LambdaFunctionAssociations.Items.push({
      EventType: eventType,
      LambdaFunctionARN: lambdaAtEdgeConfig[eventType],
      IncludeBody: true
    });
  });
};
