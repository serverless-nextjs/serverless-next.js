module.exports = async (cf) => {
  const {
    CloudFrontOriginAccessIdentity: { Id, S3CanonicalUserId }
  } = await cf
    .createCloudFrontOriginAccessIdentity({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: "serverless-managed-cloudfront-access-identity",
        Comment:
          "CloudFront Origin Access Identity created to allow serving private S3 content"
      }
    })
    .promise();

  return { originAccessIdentityId: Id, s3CanonicalUserId: S3CanonicalUserId };
};
