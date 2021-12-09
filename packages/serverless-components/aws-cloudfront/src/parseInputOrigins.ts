import {
  getOriginConfig,
  OriginConfig,
  Origin,
  Options
} from "./getOriginConfig";
import getCacheBehavior from "./getCacheBehavior";
import addLambdaAtEdgeToCacheBehavior, {
  CacheBehavior
} from "./addLambdaAtEdgeToCacheBehavior";

export default (origins: Origin[], options: Options) => {
  const distributionOrigins: {
    Quantity: number;
    Items: OriginConfig[];
  } = {
    Quantity: 0,
    Items: []
  };

  const distributionCacheBehaviors: {
    Quantity: number;
    Items: any;
  } = {
    Quantity: 0,
    Items: []
  };

  for (const origin of origins) {
    const newOriginConfig = getOriginConfig(origin, options);
    const originConfig =
      distributionOrigins.Items.find(({ Id }) => Id === newOriginConfig.Id) ||
      newOriginConfig;

    if (originConfig === newOriginConfig) {
      distributionOrigins.Quantity = distributionOrigins.Quantity + 1;
      distributionOrigins.Items.push(originConfig);
    }

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
          cacheBehavior as CacheBehavior,
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
