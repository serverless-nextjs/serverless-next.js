const Stream = require("stream");
const queryString = require("querystring");
const http = require("http");

const reqResMapper = (event, callback) => {
  const base64Support = process.env.BINARY_SUPPORT === "yes";
  const response = {
    isBase64Encoded: base64Support,
    multiValueHeaders: {}
  };
  let responsePromise;

  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, http.IncomingMessage.prototype);
  req.url =
    (event.requestContext.path || event.path || "").replace(
      new RegExp("^/" + event.requestContext.stage),
      ""
    ) || "/";

  let qs = "";

  if (event.multiValueQueryStringParameters) {
    qs += queryString.stringify(event.multiValueQueryStringParameters);
  }

  if (event.pathParameters) {
    const pathParametersQs = queryString.stringify(event.pathParameters);

    if (qs.length > 0) {
      qs += `&${pathParametersQs}`;
    } else {
      qs += pathParametersQs;
    }
  }

  const hasQueryString = qs.length > 0;

  if (hasQueryString) {
    req.url += `?${qs}`;
  }

  req.method = event.httpMethod;
  req.rawHeaders = [];
  req.headers = {};

  const headers = event.multiValueHeaders || {};

  for (const key of Object.keys(headers)) {
    for (const value of headers[key]) {
      req.rawHeaders.push(key);
      req.rawHeaders.push(value);
    }
    req.headers[key.toLowerCase()] = headers[key].toString();
  }

  req.getHeader = name => {
    return req.headers[name.toLowerCase()];
  };
  req.getHeaders = () => {
    return req.headers;
  };

  req.connection = {};

  const res = new Stream();
  Object.defineProperty(res, "statusCode", {
    get() {
      return response.statusCode;
    },
    set(statusCode) {
      response.statusCode = statusCode;
    }
  });
  res.headers = {};
  res.writeHead = (status, headers) => {
    response.statusCode = status;
    if (headers) res.headers = Object.assign(res.headers, headers);
  };
  res.write = chunk => {
    if (!response.body) {
      response.body = Buffer.from("");
    }

    response.body = Buffer.concat([
      Buffer.isBuffer(response.body)
        ? response.body
        : Buffer.from(response.body),
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ]);
  };
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.removeHeader = name => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = name => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };
  res.hasHeader = name => {
    return !!res.getHeader(name);
  };

  const onResEnd = (callback, resolve) => text => {
    if (text) res.write(text);
    if (!res.statusCode) {
      res.statusCode = 200;
    }

    if (response.body) {
      response.body = Buffer.from(response.body).toString(
        base64Support ? "base64" : undefined
      );
    }
    response.multiValueHeaders = res.headers;
    res.writeHead(response.statusCode);
    fixApiGatewayMultipleHeaders();

    if (callback) {
      callback(null, response);
    } else {
      resolve(response);
    }
  };

  if (typeof callback === "function") {
    res.end = onResEnd(callback);
  } else {
    responsePromise = new Promise(resolve => {
      res.end = onResEnd(null, resolve);
    });
  }

  if (event.body) {
    req.push(event.body, event.isBase64Encoded ? "base64" : undefined);
  }

  req.push(null);

  function fixApiGatewayMultipleHeaders() {
    for (const key of Object.keys(response.multiValueHeaders)) {
      if (!Array.isArray(response.multiValueHeaders[key])) {
        response.multiValueHeaders[key] = [response.multiValueHeaders[key]];
      }
    }
  }

  return { req, res, responsePromise };
};

module.exports = reqResMapper;
