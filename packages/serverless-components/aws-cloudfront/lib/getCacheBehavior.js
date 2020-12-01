const { getForwardedValues } = require("./cacheBahaviorUtils");

module.exports = (pathPattern, pathPatternConfig, originId) => {
  const {
    allowedHttpMethods = ["GET", "HEAD"],
    ttl,
    compress = true,
    smoothStreaming = false,
    viewerProtocolPolicy = "https-only",
    fieldLevelEncryptionId = "",
    cachePolicyId,
    originRequestPolicyId
  } = pathPatternConfig;

  const cacheBehaviour = {
    PathPattern: pathPattern,
    TargetOriginId: originId,
    TrustedSigners: {
      Enabled: false,
      Quantity: 0
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Items: ["GET", "HEAD"],
        Quantity: 2
      }
    },
    Compress: compress,
    SmoothStreaming: smoothStreaming,
    FieldLevelEncryptionId: fieldLevelEncryptionId,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: []
    }
  };

  if (cachePolicyId) {
    cacheBehaviour.CachePolicyId = cachePolicyId;
  } else {
    cacheBehaviour.ForwardedValues = getForwardedValues(
      pathPatternConfig.forward,
      {
        cookies: "all",
        queryString: true
      }
    );
    cacheBehaviour.MinTTL = 0;
    cacheBehaviour.DefaultTTL = ttl;
    cacheBehaviour.MaxTTL = 31536000;
  }

  if (originRequestPolicyId) {
    cacheBehaviour.OriginRequestPolicyId = originRequestPolicyId;
  }

  return cacheBehaviour;
};
