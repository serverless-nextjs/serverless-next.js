const zlib = require("zlib");
const create = require("../next-aws-cloudfront");

describe("Response Tests", () => {
  it("statusCode writeHead 404", () => {
    expect.assertions(1);

    const { responsePromise, res } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.writeHead(404);
    res.end();

    return responsePromise.then((response) => {
      expect(response.status).toEqual("404");
    });
  });

  it("statusCode statusCode=200", () => {
    expect.assertions(2);

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.statusCode = 200;
    res.end();

    return responsePromise.then((response) => {
      expect(response.status).toEqual("200");
      expect(response.statusDescription).toEqual("OK");
    });
  });

  it("statusCode statusCode=200 by default", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.end();

    return responsePromise.then((response) => {
      expect(response.status).toEqual("200");
    });
  });

  it("writeHead headers", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.writeHead(200, {
      "x-custom-1": "1",
      "x-custom-2": "2"
    });
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "x-custom-1": [
          {
            key: "x-custom-1",
            value: "1"
          }
        ],
        "x-custom-2": [
          {
            key: "x-custom-2",
            value: "2"
          }
        ]
      });
    });
  });

  it("writeHead ignores special CloudFront Headers", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    const cloudFrontReadOnlyHeaders = {
      "Accept-Encoding": "gzip",
      "Content-Length": "1234",
      "If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT",
      "If-None-Match": "*",
      "If-Range": "Wed, 21 Oct 2015 07:28:00 GMT",
      "If-Unmodified-Since": "Wed, 21 Oct 2015 07:28:00 GMT",
      "Transfer-Encoding": "compress",
      Via: "HTTP/1.1 GWA"
    };

    res.writeHead(200, cloudFrontReadOnlyHeaders);
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({});
    });
  });

  it("writeHead preserves existing Headers", () => {
    expect.assertions(1);

    const cloudFrontReadOnlyHeaders = {
      "Content-Length": "1234",
      "x-custom-1": "1"
    };

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      },
      response: {
        headers: cloudFrontReadOnlyHeaders
      }
    });

    res.writeHead(200, {});
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "content-length": "1234",
        "x-custom-1": "1"
      });
    });
  });

  it("writeHead does not overwrite special CloudFront Headers", () => {
    expect.assertions(1);

    const cloudFrontReadOnlyHeaders = {
      "Content-Length": "1234"
    };

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      },
      response: {
        headers: cloudFrontReadOnlyHeaders
      }
    });

    res.writeHead(200, { "Content-Length": "4321" });
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({ "content-length": "1234" });
    });
  });

  it("writeHead can be chained", () => {
    const { res, responsePromise } = create({
      request: { uri: "/", headers: {} }
    });

    res.writeHead(200, { "Content-Length": "1234" }).end();

    return responsePromise;
  });

  it("setHeader (multiple headers with same name)", () => {
    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.setHeader("set-cookie", ["1", "2"]);
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "set-cookie": [
          {
            key: "set-cookie",
            value: "1"
          },
          {
            key: "set-cookie",
            value: "2"
          }
        ]
      });
    });
  });

  it("setHeader", () => {
    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "x-custom-1": [
          {
            key: "x-custom-1",
            value: "1"
          }
        ],
        "x-custom-2": [
          {
            key: "x-custom-2",
            value: "2"
          }
        ]
      });
    });
  });

  it("setHeader ignores special CloudFront headers", () => {
    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.setHeader("Content-Length", "123");
    res.setHeader("x-custom-2", "2");
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "x-custom-2": [
          {
            key: "x-custom-2",
            value: "2"
          }
        ]
      });
    });
  });

  it("setHeader + removeHeader", () => {
    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.removeHeader("x-custom-1");
    res.end();

    return responsePromise.then((response) => {
      expect(response.headers).toEqual({
        "x-custom-2": [
          {
            key: "x-custom-2",
            value: "2"
          }
        ]
      });
    });
  });

  it("getHeader/s", () => {
    const { res } = create({
      request: {
        path: "/",
        headers: {}
      }
    });
    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    expect(res.getHeader("x-custom-1")).toEqual("1");
    expect(res.getHeaders()).toEqual({
      "x-custom-1": "1",
      "x-custom-2": "2"
    });
  });

  it("hasHeader", () => {
    const { res } = create({
      request: {
        path: "/",
        headers: {}
      }
    });
    res.setHeader("x-custom-1", "1");

    expect(res.hasHeader("x-custom-1")).toBe(true);
    expect(res.hasHeader("x-custom-2")).toBe(false);
  });

  it("case insensitive headers", () => {
    const { res } = create({
      request: {
        path: "/",
        headers: {}
      }
    });
    res.setHeader("x-custom-1", "1");
    res.setHeader("X-CUSTOM-2", "2");
    res.setHeader("X-cUsToM-3", "3");

    expect(res.getHeader("X-CUSTOM-1")).toEqual("1");
    expect(res.getHeader("x-custom-2")).toEqual("2");
    expect(res.getHeader("x-CuStOm-3")).toEqual("3");

    expect(res.getHeaders()).toEqual({
      "x-custom-1": "1",
      "x-custom-2": "2",
      "x-custom-3": "3"
    });

    res.removeHeader("X-CUSTOM-1");
    res.removeHeader("x-custom-2");
    res.removeHeader("x-CUSTom-3");

    expect(res.getHeaders()).toEqual({});
  });

  it(`res.write('ok')`, () => {
    expect.assertions(2);

    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.write("ok");
    res.end();

    return responsePromise.then((response) => {
      expect(response.body).toEqual("b2s=");
      expect(response.bodyEncoding).toEqual("base64");
    });
  });

  it(`res.end('ok')`, () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.end("ok");

    return responsePromise.then((response) => {
      expect(response.body).toEqual("b2s=");
    });
  });

  it("res.end() ignores any calls after the first one", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.end("ok");
    res.end();

    return responsePromise.then((response) => {
      expect(response.body).toEqual("b2s=");
    });
  });

  it("does not gzip by default", () => {
    expect.assertions(3);

    const gzipSpy = jest.spyOn(zlib, "gzipSync");

    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {
          "accept-encoding": [
            {
              key: "Accept-Encoding",
              value: "gzip"
            }
          ]
        }
      }
    });

    res.end("ok");

    return responsePromise.then((response) => {
      expect(gzipSpy).not.toBeCalled();
      expect(response.headers["content-encoding"]).not.toBeDefined();
      expect(response.body).toEqual("b2s=");
    });
  });

  it(`gzips when compression is enabled`, () => {
    expect.assertions(2);

    const gzipSpy = jest.spyOn(zlib, "gzipSync");
    gzipSpy.mockReturnValueOnce(Buffer.from("ok-gzipped"));

    const { res, responsePromise } = create(
      {
        request: {
          path: "/",
          headers: {
            "accept-encoding": [
              {
                key: "Accept-Encoding",
                value: "gzip"
              }
            ]
          }
        }
      },
      {
        enableHTTPCompression: true
      }
    );

    res.end("ok");

    gzipSpy.mockRestore();

    return responsePromise.then((response) => {
      expect(response.headers["content-encoding"]).toEqual([
        { key: "Content-Encoding", value: "gzip" }
      ]);
      expect(response.body).toEqual("b2stZ3ppcHBlZA=="); // "ok-gzipped" base64 encoded
    });
  });

  it("response does not have a body if only statusCode is set", () => {
    expect.assertions(4);

    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.statusCode = 204;
    res.end();

    return responsePromise.then((response) => {
      expect(response.body).not.toBeDefined();
      expect(response.bodyEncoding).not.toBeDefined();
      expect(response.status).toEqual("204");
      expect(response.statusDescription).toEqual("No Content");
    });
  });
});
