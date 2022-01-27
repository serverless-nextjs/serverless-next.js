import addLambdaAtEdgeToCacheBehavior from "./addLambdaAtEdgeToCacheBehavior";
import { getForwardedValues } from "./cacheBehaviorUtils";

type DefaultCacheBehavior = {
  allowedHttpMethods?: string[];
  forward?: Record<string, string>;
  minTTL?: number;
  defaultTTL?: number;
  maxTTL?: number;
  compress?: boolean;
  smoothStreaming?: boolean;
  viewerProtocolPolicy?: string;
  fieldLevelEncryptionId?: string;
  responseHeadersPolicyId?: string;
  realtimeLogConfigArn?: string;
};

export default (originId, defaults: DefaultCacheBehavior = {}) => {
  const {
    allowedHttpMethods = ["HEAD", "GET"],
    forward = {},
    minTTL = 0,
    defaultTTL = 86400,
    maxTTL = 31536000,
    compress = false,
    smoothStreaming = false,
    viewerProtocolPolicy = "redirect-to-https",
    fieldLevelEncryptionId = "",
    responseHeadersPolicyId = "",
    realtimeLogConfigArn = undefined
  } = defaults;

  const defaultCacheBehavior = {
    TargetOriginId: originId,
    ForwardedValues: getForwardedValues(forward),
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
      Items: []
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    MinTTL: minTTL,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Quantity: 2,
        Items: ["HEAD", "GET"]
      }
    },
    SmoothStreaming: smoothStreaming,
    DefaultTTL: defaultTTL,
    MaxTTL: maxTTL,
    Compress: compress,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: []
    },
    FieldLevelEncryptionId: fieldLevelEncryptionId,
    ResponseHeadersPolicyId: responseHeadersPolicyId,
    RealtimeLogConfigArn: realtimeLogConfigArn
  };

  addLambdaAtEdgeToCacheBehavior(defaultCacheBehavior, defaults["lambda@edge"]);

  return defaultCacheBehavior;
};
