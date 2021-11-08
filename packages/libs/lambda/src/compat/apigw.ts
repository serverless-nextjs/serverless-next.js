import { IncomingMessage, ServerResponse } from "http";
import Query from "querystring";
import { Stream } from "stream";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from "aws-lambda";

/**
 * This is a compatibility later to replace req/res methods in order to bridge to APIGateway events.
 * @param event
 */
export const httpCompat = (
  event: APIGatewayProxyEventV2
): {
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<APIGatewayProxyStructuredResultV2>;
} => {
  const response: APIGatewayProxyStructuredResultV2 = {
    headers: {}
  };
  let tempResponseBody: Buffer;

  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, IncomingMessage.prototype) as any;

  const { queryStringParameters, rawPath } = event;
  const stage = event.requestContext.stage;
  // Need to remove the API Gateway stage in the normalized raw path
  let normalizedRawPath = rawPath.replace(`/${stage}`, "");
  normalizedRawPath = normalizedRawPath === "" ? "/" : normalizedRawPath;
  const qs = queryStringParameters
    ? Query.stringify(queryStringParameters)
    : "";

  const hasQueryString = qs.length > 0;
  req.url = hasQueryString ? `${normalizedRawPath}?${qs}` : normalizedRawPath;

  req.method = event.requestContext.http.method;
  req.rawHeaders = [];
  req.headers = {};

  for (const [key, value] of Object.entries(event.headers)) {
    req.headers[key.toLowerCase()] = value;
  }

  req.getHeader = (name: string) => {
    return req.headers[name.toLowerCase()];
  };
  req.getHeaders = () => {
    return req.headers;
  };
  req.connection = {};

  const res = new Stream() as any;
  Object.defineProperty(res, "statusCode", {
    get() {
      return response.statusCode;
    },
    set(statusCode) {
      response.statusCode = statusCode;
    }
  });

  const headerNames: { [key: string]: string } = {};
  res.headers = {};
  res.writeHead = (
    status: number,
    headers: { [key: string]: string | string[] }
  ) => {
    response.statusCode = status;
    res.headers = { ...res.headers, ...headers };
  };
  res.write = (chunk: Buffer | string) => {
    // Use tempResponseBody to buffers until needed to convert to base64-encoded string for APIGateway response
    // Otherwise binary data (such as images) can get corrupted
    if (!tempResponseBody) {
      tempResponseBody = Buffer.from("");
    }

    tempResponseBody = Buffer.concat([
      tempResponseBody,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ]);
  };
  res.setHeader = (name: string, value: string) => {
    headerNames[name.toLowerCase()] = name;
    res.headers[name.toLowerCase()] = value;
  };
  res.removeHeader = (name: string) => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = (name: string) => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };
  res.hasHeader = (name: string) => {
    return !!res.getHeader(name);
  };

  const onResEnd =
    (resolve: (value: APIGatewayProxyStructuredResultV2) => void) =>
    (text: Buffer | string) => {
      if (text) {
        res.write(text);
      }
      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (tempResponseBody) {
        response.body = Buffer.from(tempResponseBody).toString("base64");
        response.isBase64Encoded = true;
      }
      res.writeHead(response.statusCode);

      response.headers = {};
      for (const [key, value] of Object.entries(res.headers) as [
        string,
        string | string[]
      ][]) {
        response.headers[headerNames[key] || key] = Array.isArray(value)
          ? value.join(",")
          : value;
      }

      resolve(response);
    };

  const responsePromise: Promise<APIGatewayProxyStructuredResultV2> =
    new Promise((resolve) => {
      res.end = onResEnd(resolve);
    });

  if (event.body) {
    req.push(event.body, event.isBase64Encoded ? "base64" : undefined);
  }

  req.push(null);

  return { req, res, responsePromise };
};
