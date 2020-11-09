module.exports = (cachePolicyInput) => {
  const {
    cookiesConfig,
    headersConfig,
    queryStringsConfig
  } = cachePolicyInput.parametersInCacheKeyAndForwardedToOrigin;
  const cookies = cookiesConfig.cookies || [];
  const headers = headersConfig.headers || [];
  const queryStrings = queryStringsConfig.queryStrings || [];

  return {
    CachePolicyConfig: {
      MinTTL: cachePolicyInput.minTTL,
      Name: cachePolicyInput.name,
      Comment: cachePolicyInput.comment,
      DefaultTTL: cachePolicyInput.defaultTTL,
      MaxTTL: cachePolicyInput.maxTTL,
      ParametersInCacheKeyAndForwardedToOrigin: {
        CookiesConfig: {
          CookieBehavior: cookiesConfig.cookieBehavior,
          Cookies: {
            Quantity: cookies.length,
            Items: cookies
          }
        },
        EnableAcceptEncodingGzip: cachePolicyInput.enableAcceptEncodingGzip,
        HeadersConfig: {
          HeaderBehavior: headersConfig.headerBehavior,
          Headers: {
            Quantity: headers.length,
            Items: headers
          }
        },
        QueryStringsConfig: {
          QueryStringBehavior: queryStringsConfig.queryStringBehavior,
          QueryStrings: {
            Quantity: queryStrings.length,
            Items: queryStrings
          }
        },
        EnableAcceptEncodingBrotli: cachePolicyInput.enableAcceptEncodingBrotli
      }
    }
  };
};
