const Stream = require("stream");

const specialNodeHeaders = [
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
];

const readOnlyCloudFrontHeaders = {
  "accept-encoding": true,
  "content-length": true,
  "if-modified-since": true,
  "if-none-match": true,
  "if-range": true,
  "if-unmodified-since": true,
  "transfer-encoding": true,
  via: true
};

const toCloudFrontHeaders = headers => {
  const result = {};

  Object.keys(headers).forEach(headerName => {
    if (!readOnlyCloudFrontHeaders[headerName.toLowerCase()]) {
      result[headerName] = [
        {
          key: headerName,
          value: headers[headerName].toString()
        }
      ];
    }
  });

  return result;
};

const handler = event => {
  const { request: cfRequest } = event;

  const response = {
    body: Buffer.from(""),
    bodyEncoding: "base64",
    status: 200,
    statusDescription: "OK",
    headers: {}
  };

  const req = new Stream.Readable();
  req.url = cfRequest.uri;
  req.method = cfRequest.method;
  req.rawHeaders = [];
  req.headers = {};
  req.connection = {};

  if (cfRequest.querystring) {
    req.url = req.url + `?` + cfRequest.querystring;
  }

  const headers = cfRequest.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const headerKeyValPairs = headers[lowercaseKey];

    headerKeyValPairs.forEach(keyVal => {
      req.rawHeaders.push(keyVal.key);
      req.rawHeaders.push(keyVal.value);
    });

    req.headers[lowercaseKey] = headerKeyValPairs[0].value;
  }

  req.getHeader = name => {
    return req.headers[name.toLowerCase()];
  };

  req.getHeaders = () => {
    return req.headers;
  };

  if (cfRequest.body && cfRequest.body.data) {
    req.push(
      cfRequest.body.data,
      cfRequest.body.encoding ? "base64" : undefined
    );
  }

  req.push(null);

  const res = new Stream();
  res.finished = false;

  Object.defineProperty(res, "statusCode", {
    get() {
      return response.status;
    },
    set(statusCode) {
      response.status = statusCode;
    }
  });

  res.headers = {};
  res.writeHead = (status, headers) => {
    response.status = status;
    if (headers) {
      res.headers = Object.assign(res.headers, headers);
    }
  };
  res.write = chunk => {
    response.body = Buffer.concat([
      response.body,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ]);
  };

  const responsePromise = new Promise(resolve => {
    res.end = text => {
      if (text) res.write(text);
      res.finished = true;
      response.body = Buffer.from(response.body).toString("base64");
      response.headers = toCloudFrontHeaders(res.headers);

      resolve(response);
    };
  });

  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.removeHeader = name => {
    delete res.headers[name];
  };
  res.getHeader = name => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };

  return {
    req,
    res,
    responsePromise
  };
};

handler.SPECIAL_NODE_HEADERS = specialNodeHeaders;

module.exports = handler;
