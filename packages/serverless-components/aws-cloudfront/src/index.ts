import parseInputOrigins from "./parseInputOrigins";
import getDefaultCacheBehavior from "./getDefaultCacheBehavior";
import createOriginAccessIdentity from "./createOriginAccessIdentity";
import grantCloudFrontBucketAccess from "./grantCloudFrontBucketAccess";
import getCustomErrorResponses from "./getCustomErrorResponses";
import AWS from "aws-sdk";

const DEFAULT_MINIMUM_PROTOCOL_VERSION = "TLSv1.2_2019";
const DEFAULT_SSL_SUPPORT_METHOD = "sni-only";

const servePrivateContentEnabled = (inputs) =>
  inputs.origins.some((origin) => {
    return origin && origin.private === true;
  });

const updateBucketsPolicies = async (
  s3: AWS.S3,
  origins,
  s3CanonicalUserId: string
) => {
  // update bucket policies with cloudfront access
  const bucketNames = origins.Items.filter(
    (origin) => origin.S3OriginConfig
  ).map((origin) => origin.Id);

  await Promise.all(
    bucketNames.map((bucketName) =>
      grantCloudFrontBucketAccess(s3, bucketName, s3CanonicalUserId)
    )
  );
};

const createCloudFrontDistribution = async (
  cf: AWS.CloudFront,
  s3: AWS.S3,
  inputs: Record<string, any>
): Promise<{ id: string; arn: string; url: string }> => {
  const params = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      Comment:
        inputs.comment !== null && inputs.comment !== undefined
          ? inputs.comment
          : "",
      Aliases:
        // For initial creation if aliases undefined, then have default empty array of aliases
        // Although this is not required per https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_DistributionConfig.html
        inputs.aliases !== null && inputs.aliases !== undefined
          ? {
              Quantity: inputs.aliases.length,
              Items: inputs.aliases
            }
          : {
              Quantity: 0,
              Items: []
            },
      Origins: {
        Quantity: 0,
        Items: []
      },
      CustomErrorResponses: {
        Quantity: 0,
        Items: []
      },
      PriceClass: inputs.priceClass,
      Enabled: inputs.enabled,
      HttpVersion: "http2",
      DefaultCacheBehavior: undefined
    },
    Tags: {
      Items: []
    }
  };

  const distributionConfig: any = params.DistributionConfig;

  let originAccessIdentityId;
  let s3CanonicalUserId;

  if (servePrivateContentEnabled(inputs)) {
    ({ originAccessIdentityId, s3CanonicalUserId } =
      await createOriginAccessIdentity(cf));
  }

  const { Origins, CacheBehaviors } = parseInputOrigins(inputs.origins, {
    originAccessIdentityId
  });

  if (s3CanonicalUserId) {
    await updateBucketsPolicies(s3, Origins, s3CanonicalUserId);
  }

  distributionConfig.Origins = Origins;

  // set first origin declared as the default cache behavior
  distributionConfig.DefaultCacheBehavior = getDefaultCacheBehavior(
    Origins.Items[0].Id,
    inputs.defaults
  );

  if (CacheBehaviors) {
    distributionConfig.CacheBehaviors = CacheBehaviors;
  }

  distributionConfig.CustomErrorResponses = getCustomErrorResponses(
    inputs.errorPages
  );

  // Set WAF web ACL id if defined
  if (inputs.webACLId !== undefined && inputs.webACLId !== null) {
    distributionConfig.WebACLId = inputs.webACLId;
  }

  // Set restrictions
  if (inputs.restrictions !== undefined && inputs.restrictions !== null) {
    const geoRestriction = inputs.restrictions.geoRestriction;

    distributionConfig.Restrictions = {
      GeoRestriction: {
        RestrictionType: geoRestriction.restrictionType,
        Quantity: geoRestriction.items ? geoRestriction.items.length : 0
      }
    };

    if (geoRestriction.items && geoRestriction.items.length > 0) {
      distributionConfig.Restrictions.GeoRestriction.Items =
        geoRestriction.items;
    }
  }

  // Note this will override the certificate which is also set by domain input
  if (inputs.certificate !== undefined && inputs.certificate !== null) {
    if (typeof inputs.certificate !== "object") {
      throw new Error(
        "Certificate input must be an object with cloudFrontDefaultCertificate, acmCertificateArn, iamCertificateId, sslSupportMethod, minimumProtocolVersion."
      );
    }

    distributionConfig.ViewerCertificate = {
      CloudFrontDefaultCertificate:
        inputs.certificate.cloudFrontDefaultCertificate,
      ACMCertificateArn: inputs.certificate.acmCertificateArn,
      IAMCertificateId: inputs.certificate.iamCertificateId,
      SSLSupportMethod:
        inputs.certificate.sslSupportMethod || DEFAULT_SSL_SUPPORT_METHOD,
      MinimumProtocolVersion:
        inputs.certificate.minimumProtocolVersion ||
        DEFAULT_MINIMUM_PROTOCOL_VERSION
    };
  }

  // Set tags if any given in inputs
  const tagsList = [];
  for (const [key, value] of Object.entries(inputs.tags ?? {})) {
    tagsList.push({ Key: key, Value: value });
  }
  params.Tags.Items = tagsList;

  const res = await cf
    .createDistributionWithTags({ DistributionConfigWithTags: params })
    .promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  };
};

const updateCloudFrontDistribution = async (
  cf: any,
  s3: AWS.S3,
  distributionId: string,
  inputs: Record<string, any>
): Promise<{ id: string; arn: string; url: string }> => {
  // Update logic is a bit weird...
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property

  // 1. we gotta get the config first...
  // todo what if id does not exist?
  const params = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  // 2. then add this property
  params.IfMatch = params.ETag;

  // 3. then delete this property
  delete params.ETag;

  // 4. then set this property
  params.Id = distributionId;

  // 5. then make our changes

  params.DistributionConfig.Enabled = inputs.enabled;
  params.DistributionConfig.Comment =
    inputs.comment !== null && inputs.comment !== undefined
      ? inputs.comment
      : "";
  params.DistributionConfig.PriceClass = inputs.priceClass;

  // When updating, don't override any existing aliases if not set in inputs
  if (inputs.aliases !== null && inputs.aliases !== undefined) {
    params.DistributionConfig.Aliases = {
      Items: inputs.aliases,
      Quantity: inputs.aliases.length
    };
  }

  // When updating, don't override any existing webACLId if not set in inputs
  if (inputs.webACLId !== undefined && inputs.webACLId !== null) {
    params.DistributionConfig.WebACLId = inputs.webACLId;
  }

  // When updating, don't override any existing geo restrictions if not set in inputs
  if (inputs.restrictions !== undefined && inputs.restrictions !== null) {
    const geoRestriction = inputs.restrictions.geoRestriction;

    params.DistributionConfig.Restrictions = {
      GeoRestriction: {
        RestrictionType: geoRestriction.restrictionType,
        Quantity: geoRestriction.items ? geoRestriction.items.length : 0,
        Items: geoRestriction.items
      }
    };

    if (geoRestriction.items && geoRestriction.items.length > 0) {
      params.DistributionConfig.Restrictions.GeoRestriction.Items =
        geoRestriction.items;
    }
  }

  // Note this will override the certificate which is also set by domain input
  if (inputs.certificate !== undefined && inputs.certificate !== null) {
    if (typeof inputs.certificate !== "object") {
      throw new Error(
        "Certificate input must be an object with cloudFrontDefaultCertificate, acmCertificateArn, iamCertificateId, sslSupportMethod, minimumProtocolVersion."
      );
    }
    params.DistributionConfig.ViewerCertificate = {
      CloudFrontDefaultCertificate:
        inputs.certificate.cloudFrontDefaultCertificate,
      ACMCertificateArn: inputs.certificate.acmCertificateArn,
      IAMCertificateId: inputs.certificate.iamCertificateId,
      SSLSupportMethod:
        inputs.certificate.sslSupportMethod || DEFAULT_SSL_SUPPORT_METHOD,
      MinimumProtocolVersion:
        inputs.certificate.minimumProtocolVersion ||
        DEFAULT_MINIMUM_PROTOCOL_VERSION
    };
  }

  let s3CanonicalUserId;
  let { originAccessIdentityId } = inputs;

  if (servePrivateContentEnabled(inputs)) {
    // presumably it's ok to call create origin access identity again
    // aws api returns cached copy of what was previously created
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createCloudFrontOriginAccessIdentity-property

    if (originAccessIdentityId) {
      ({
        CloudFrontOriginAccessIdentity: { S3CanonicalUserId: s3CanonicalUserId }
      } = await cf
        .getCloudFrontOriginAccessIdentity({ Id: originAccessIdentityId })
        .promise());
    } else {
      ({ originAccessIdentityId, s3CanonicalUserId } =
        await createOriginAccessIdentity(cf));
    }
  }

  const { Origins, CacheBehaviors } = parseInputOrigins(inputs.origins, {
    originAccessIdentityId
  });

  if (s3CanonicalUserId) {
    await updateBucketsPolicies(s3, Origins, s3CanonicalUserId);
  }

  params.DistributionConfig.DefaultCacheBehavior = getDefaultCacheBehavior(
    Origins.Items[0].Id,
    inputs.defaults
  );

  const origins = params.DistributionConfig.Origins;
  const inputOrigins = Origins;
  const existingOriginIds = origins.Items.map((origin) => origin.Id);

  inputOrigins.Items.forEach((inputOrigin) => {
    const originIndex = existingOriginIds.indexOf(inputOrigin.Id);

    if (originIndex > -1) {
      // replace origin with new input configuration
      origins.Items.splice(originIndex, 1, inputOrigin);
    } else {
      origins.Items.push(inputOrigin);
      origins.Quantity += 1;
    }
  });

  if (CacheBehaviors) {
    const behaviors = (params.DistributionConfig.CacheBehaviors = params
      .DistributionConfig.CacheBehaviors || { Items: [] });
    const behaviorPaths = behaviors.Items.map((b) => b.PathPattern);
    CacheBehaviors.Items.forEach((inputBehavior) => {
      const behaviorIndex = behaviorPaths.indexOf(inputBehavior.PathPattern);
      if (behaviorIndex > -1) {
        // replace origin with new input configuration
        behaviors.Items.splice(behaviorIndex, 1, inputBehavior);
      } else {
        behaviors.Items.push(inputBehavior);
      }
    });
    behaviors.Quantity = behaviors.Items.length;
  }

  params.DistributionConfig.CustomErrorResponses = getCustomErrorResponses(
    inputs.errorPages
  );

  // 6. then finally update!
  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  };
};

const disableCloudFrontDistribution = async (cf, distributionId: string) => {
  const params = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  params.IfMatch = params.ETag;

  delete params.ETag;

  params.Id = distributionId;

  params.DistributionConfig.Enabled = false;

  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  };
};

const deleteCloudFrontDistribution = async (
  cf: AWS.CloudFront,
  distributionId: string
): Promise<void> => {
  try {
    const res = await cf
      .getDistributionConfig({ Id: distributionId })
      .promise();

    const params = { Id: distributionId, IfMatch: res.ETag };
    await cf.deleteDistribution(params).promise();
  } catch (e) {
    if (e.code === "DistributionNotDisabled") {
      await disableCloudFrontDistribution(cf, distributionId);
    } else {
      throw e;
    }
  }
};

const setCloudFrontDistributionTags = async (
  cf: AWS.CloudFront,
  distributionArn: string,
  tags: Record<string, string>
) => {
  const listTagsResponse = await cf
    .listTagsForResource({
      Resource: distributionArn
    })
    .promise();

  const existingTags = {};
  if (listTagsResponse.Tags && listTagsResponse.Tags.Items) {
    for (const tag of listTagsResponse.Tags.Items) {
      existingTags[tag.Key] = tag.Value;
    }
  }

  // Remove tags if there are any
  if (Object.keys(existingTags).length > 0) {
    await cf
      .untagResource({
        Resource: distributionArn,
        TagKeys: {
          Items: Object.keys(existingTags)
        }
      })
      .promise();
  }

  // Add new tags if there are any
  const newTags = [];
  for (const [key, value] of Object.entries(tags)) {
    newTags.push({ Key: key, Value: value });
  }

  if (newTags.length > 0) {
    await cf
      .tagResource({
        Resource: distributionArn,
        Tags: {
          Items: newTags
        }
      })
      .promise();
  }
};

export {
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution,
  setCloudFrontDistributionTags
};
