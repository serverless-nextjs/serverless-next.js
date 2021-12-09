export const s3BucketNameFromEventRequest = (
  request: AWSLambda.CloudFrontRequest
): string | undefined => {
  const { region, domainName } = request.origin?.s3 || {};
  return !!region && domainName?.includes(region)
    ? domainName?.replace(`.s3.${region}.amazonaws.com`, "")
    : domainName?.replace(`.s3.amazonaws.com`, "");
};
