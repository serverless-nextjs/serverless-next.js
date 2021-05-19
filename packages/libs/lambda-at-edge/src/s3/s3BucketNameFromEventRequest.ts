export const s3BucketNameFromEventRequest = (
  request: AWSLambda.CloudFrontRequest
): string | undefined => {
  const { region, domainName } = request.origin?.s3 || {};
  return domainName?.replace(`.s3.${region}.amazonaws.com`, "");
};
