// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages.html
// 200 status code is also valid according to: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-response-code.html
const CF_ALLOWED_ERROR_CODES = [
  200, 400, 403, 404, 405, 414, 416, 500, 501, 502, 503, 504
];

const errorResponse = (errorPage) => {
  errorPage.responseCode = errorPage.responseCode || errorPage.code;

  if (!CF_ALLOWED_ERROR_CODES.includes(errorPage.code)) {
    throw Error(`CloudFront error code "${errorPage.code}" is not supported`);
  }
  if (!CF_ALLOWED_ERROR_CODES.includes(errorPage.responseCode)) {
    throw Error(
      `CloudFront error code "${errorPage.responseCode}" is not supported`
    );
  }

  return {
    ErrorCode: `${errorPage.code}`,
    ErrorCachingMinTTL: `${errorPage.minTTL || 10}`,
    ResponseCode: `${errorPage.responseCode}`,
    ResponsePagePath: errorPage.path
  };
};

export default (errorPages = []) => {
  return {
    Quantity: errorPages.length,
    Items: errorPages.map(errorResponse)
  };
};
