const getOriginConfig = require("./getOriginConfig");
const getCacheBehavior = require("./getCacheBehavior");
const addLambdaAtEdgeToCacheBehavior = require("./addLambdaAtEdgeToCacheBehavior");

module.exports = (origins, options) => {
  const distributionOrigins = {
    Quantity: 0,
    Items: []
  };

  const distributionCacheBehaviors = {
    Quantity: 0,
    Items: []
  };

  for (const origin of origins) {
    const originConfig = getOriginConfig(origin, options);

    distributionOrigins.Quantity = distributionOrigins.Quantity + 1;
    distributionOrigins.Items.push(originConfig);

    if (typeof origin === "object") {
      // add any cache behaviors
      for (const pathPattern in origin.pathPatterns) {
        const pathPatternConfig = origin.pathPatterns[pathPattern];
        const cacheBehavior = getCacheBehavior(
          pathPattern,
          pathPatternConfig,
          originConfig.Id
        );

        addLambdaAtEdgeToCacheBehavior(
          cacheBehavior,
          pathPatternConfig["lambda@edge"]
        );

        distributionCacheBehaviors.Quantity =
          distributionCacheBehaviors.Quantity + 1;
        distributionCacheBehaviors.Items.push(cacheBehavior);
      }
    }
  }

  return {
    Origins: distributionOrigins,
    CacheBehaviors: distributionCacheBehaviors
  };
};
