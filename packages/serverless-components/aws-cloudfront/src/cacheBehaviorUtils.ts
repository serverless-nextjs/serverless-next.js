const forwardDefaults = {
  cookies: "none",
  queryString: false
};

type ForwardedValues = {
  cookies?: string | string[];
  queryString?: string;
  headers?: string | string[];
  queryStringCacheKeys?: string[];
};

/**
 * @param config User-defined config
 * @param defaults Default framework values (default cache behavior and custom cache behavior have different default values)
 * @returns Object
 */

function getForwardedValues(
  config: ForwardedValues = {},
  defaults = {}
): Record<string, unknown> {
  const defaultValues = { ...forwardDefaults, ...defaults };
  const {
    cookies,
    queryString = defaultValues.queryString,
    headers,
    queryStringCacheKeys
  } = config;

  // Cookies
  const forwardCookies: {
    Forward: string;
    WhitelistedNames?: Record<string, unknown>;
  } = {
    Forward: defaultValues.cookies
  };

  if (typeof cookies === "string") {
    forwardCookies.Forward = cookies;
  } else if (Array.isArray(cookies)) {
    forwardCookies.Forward = "whitelist";
    forwardCookies.WhitelistedNames = {
      Quantity: cookies.length,
      Items: cookies
    };
  }

  // Headers
  const forwardHeaders = {
    Quantity: 0,
    Items: []
  };

  if (typeof headers === "string" && headers === "all") {
    forwardHeaders.Quantity = 1;
    forwardHeaders.Items = ["*"];
  } else if (Array.isArray(headers)) {
    forwardHeaders.Quantity = headers.length;
    forwardHeaders.Items = headers;
  }

  // QueryStringCacheKeys
  const forwardQueryKeys = {
    Quantity: 0,
    Items: []
  };

  if (Array.isArray(queryStringCacheKeys)) {
    forwardQueryKeys.Quantity = queryStringCacheKeys.length;
    forwardQueryKeys.Items = queryStringCacheKeys;
  }

  return {
    QueryString: queryString,
    Cookies: forwardCookies,
    Headers: forwardHeaders,
    QueryStringCacheKeys: forwardQueryKeys
  };
}

export { getForwardedValues };
