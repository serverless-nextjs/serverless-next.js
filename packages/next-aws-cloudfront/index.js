const Stream = require("stream");

module.exports = event => {
  const {request: cfRequest} = event;

  const req = new Stream.Readable();
  req.url = cfRequest.uri;
  req.method = cfRequest.method;
  req.rawHeaders = [];
  req.headers = {};

  if (cfRequest.querystring) {
    // const parts = cfRequest.querystring.split("=");
    // const
    // const key = parts[0];
    // const value = encodeURIComponent(parts[1]);
    // req.url = req.url + `?${key}=${value}`;
    req.url = req.url + `?` + cfRequest.querystring;
  }

  const headers = cfRequest.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const header = headers[lowercaseKey];

    req.rawHeaders.push(header.key);
    req.rawHeaders.push(header.value);
    req.headers[lowercaseKey] = header.value;
  }

  req.getHeader = name => {
    return req.headers[name.toLowerCase()];
  };
  req.getHeaders = () => {
    return req.headers;
  };

  // if (cfRequest.body) {
  //   req.push(event.body, event.isBase64Encoded ? "base64" : undefined);
  // }

  // req.push(null);

  return {
    req
  };
};
