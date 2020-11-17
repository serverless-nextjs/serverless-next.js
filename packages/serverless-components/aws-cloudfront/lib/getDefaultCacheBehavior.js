const addLambdaAtEdgeToCacheBehavior = require("./addLambdaAtEdgeToCacheBehavior");
const { getForwardedValues } = require("./cacheBahaviorUtils");

module.exports = (originId, defaults = {}) => {
  const {
    allowedHttpMethods = ["HEAD", "GET"],
    forward = {},
    ttl = 86400,
    compress = false,
    smoothStreaming = false,
    viewerProtocolPolicy = "redirect-to-https",
    fieldLevelEncryptionId = "",
    cachePolicyId
  } = defaults;

  const defaultCacheBehavior = {
    TargetOriginId: originId,
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
      Items: []
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Quantity: 2,
        Items: ["HEAD", "GET"]
      }
    },
    SmoothStreaming: smoothStreaming,
    Compress: compress,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: []
    },
    FieldLevelEncryptionId: fieldLevelEncryptionId
  };

  if (cachePolicyId) {
    defaultCacheBehavior.CachePolicyId = cachePolicyId;
  } else {
    defaultCacheBehavior.ForwardedValues = getForwardedValues(forward);
    defaultCacheBehavior.MinTTL = 0;
    defaultCacheBehavior.DefaultTTL = ttl;
    defaultCacheBehavior.MaxTTL = 31536000;
  }

  addLambdaAtEdgeToCacheBehavior(defaultCacheBehavior, defaults["lambda@edge"]);

  return defaultCacheBehavior;
};
