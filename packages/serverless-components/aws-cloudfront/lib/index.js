const parseInputOrigins = require("./parseInputOrigins");
const getDefaultCacheBehavior = require("./getDefaultCacheBehavior");
const createOriginAccessIdentity = require("./createOriginAccessIdentity");
const grantCloudFrontBucketAccess = require("./grantCloudFrontBucketAccess");
const getCustomErrorResponses = require("./getCustomErrorResponses");

const servePrivateContentEnabled = (inputs) =>
  inputs.origins.some((origin) => {
    return origin && origin.private === true;
  });

const updateBucketsPolicies = async (s3, origins, s3CanonicalUserId) => {
  // update bucket policies with cloudfront access
  const bucketNames = origins.Items.filter(
    (origin) => origin.S3OriginConfig
  ).map((origin) => origin.Id);

  return Promise.all(
    bucketNames.map((bucketName) =>
      grantCloudFrontBucketAccess(s3, bucketName, s3CanonicalUserId)
    )
  );
};

const createCloudFrontDistribution = async (cf, s3, inputs) => {
  const params = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      Comment:
        inputs.comment !== null && inputs.comment !== undefined
          ? inputs.comment
          : "",
      Aliases: {
        Quantity: inputs.aliases.length,
        Items: inputs.aliases
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
      HttpVersion: "http2"
    }
  };

  const distributionConfig = params.DistributionConfig;

  let originAccessIdentityId;
  let s3CanonicalUserId;

  if (servePrivateContentEnabled(inputs)) {
    ({
      originAccessIdentityId,
      s3CanonicalUserId
    } = await createOriginAccessIdentity(cf));
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

  const CustomErrorResponses = getCustomErrorResponses(inputs.errorPages);
  distributionConfig.CustomErrorResponses = CustomErrorResponses;

  const res = await cf.createDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  };
};

const updateCloudFrontDistribution = async (cf, s3, distributionId, inputs) => {
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
  (params.DistributionConfig.Comment =
    inputs.comment !== null && inputs.comment !== undefined
      ? inputs.comment
      : ""),
    (params.DistributionConfig.Aliases = {
      Items: inputs.aliases,
      Quantity: inputs.aliases.length
    });
  params.DistributionConfig.PriceClass = inputs.priceClass;

  let s3CanonicalUserId;
  let originAccessIdentityId;

  if (servePrivateContentEnabled(inputs)) {
    // presumably it's ok to call create origin access identity again
    // aws api returns cached copy of what was previously created
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createCloudFrontOriginAccessIdentity-property
    ({
      originAccessIdentityId,
      s3CanonicalUserId
    } = await createOriginAccessIdentity(cf));
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
    params.DistributionConfig.CacheBehaviors = CacheBehaviors;
  }

  const CustomErrorResponses = getCustomErrorResponses(inputs.errorPages);
  params.DistributionConfig.CustomErrorResponses = CustomErrorResponses;

  // 6. then finally update!
  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: `https://${res.Distribution.DomainName}`
  };
};

const disableCloudFrontDistribution = async (cf, distributionId) => {
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

const deleteCloudFrontDistribution = async (cf, distributionId) => {
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

module.exports = {
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution
};
