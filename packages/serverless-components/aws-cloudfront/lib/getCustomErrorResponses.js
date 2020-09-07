module.exports = (errorPages = []) => {
  return {
    Quantity: errorPages.length,
    Items: errorPages.map((errorPage) => ({
      ErrorCode: `${errorPage.code}`,
      ErrorCachingMinTTL: `${errorPage.ttl || 10}`,
      ResponseCode: `${errorPage.responseCode || errorPage.code}`,
      ResponsePagePath: errorPage.path
    }))
  };
};
