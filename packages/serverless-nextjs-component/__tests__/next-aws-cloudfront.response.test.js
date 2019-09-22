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

    return responsePromise.then(response => {
      expect(response.status).toEqual(404);
    });
  });

  it("statusCode statusCode=200", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      request: {
        uri: "/",
        headers: {}
      }
    });

    res.statusCode = 200;
    res.end();

    return responsePromise.then(response => {
      expect(response.status).toEqual(200);
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

    return responsePromise.then(response => {
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

    return responsePromise.then(response => {
      expect(response.headers).toEqual({});
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

    return responsePromise.then(response => {
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

    return responsePromise.then(response => {
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

    return responsePromise.then(response => {
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

  it(`res.write('ok')`, () => {
    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.write("ok");
    res.end();

    return responsePromise.then(response => {
      expect(response.body).toEqual("b2s=");
    });
  });

  it(`res.end('ok')`, () => {
    const { res, responsePromise } = create({
      request: {
        path: "/",
        headers: {}
      }
    });

    res.end("ok");

    return responsePromise.then(response => {
      expect(response.body).toEqual("b2s=");
    });
  });
});
