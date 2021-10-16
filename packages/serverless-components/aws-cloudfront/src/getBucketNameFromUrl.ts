/**
 * Returns a bucket name for given S3 bucket url
 *
 * @param url S3 website URL
 *
 * @returns Bucket name
 */
export const getBucketNameFromUrl = (url: string): string => {
  return url.substring(0, url.lastIndexOf(".s3"));
};
