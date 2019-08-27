const create = require("../compatLayer");

describe("compatLayer.response", () => {
  it("statusCode writeHead 404", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.statusCode).toEqual(404);
        done();
      }
    );

    res.writeHead(404);
    res.end();
  });

  it("[Promise] statusCode writeHead 404", async () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.writeHead(404);
    res.end();

    return responsePromise.then(response => {
      expect(response.statusCode).toEqual(404);
    });
  });

  it("statusCode statusCode=200", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.statusCode).toEqual(200);
        done();
      }
    );
    res.statusCode = 200;
    res.end();
  });

  it("[Promise] statusCode statusCode=200", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.statusCode = 200;
    res.end();

    return responsePromise.then(response => {
      expect(response.statusCode).toEqual(200);
    });
  });

  it("writeHead headers", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.multiValueHeaders).toEqual({
          "x-custom-1": ["1"],
          "x-custom-2": ["2"]
        });
        done();
      }
    );
    res.writeHead(200, {
      "x-custom-1": "1",
      "x-custom-2": "2"
    });
    res.end();
  });

  it("[Promise] writeHead headers", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.writeHead(200, {
      "x-custom-1": "1",
      "x-custom-2": "2"
    });
    res.end();

    return responsePromise.then(response => {
      expect(response.multiValueHeaders).toEqual({
        "x-custom-1": ["1"],
        "x-custom-2": ["2"]
      });
    });
  });

  it("setHeader", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.multiValueHeaders).toEqual({
          "x-custom-1": ["1"],
          "x-custom-2": ["2"]
        });
        done();
      }
    );
    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.end();
  });

  it("[Promise] setHeader", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.end();

    return responsePromise.then(response => {
      expect(response.multiValueHeaders).toEqual({
        "x-custom-1": ["1"],
        "x-custom-2": ["2"]
      });
    });
  });

  it("multi header support for api gateway", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.multiValueHeaders).toEqual({
          "x-custom-1": ["1", "1"]
        });
        done();
      }
    );
    res.setHeader("x-custom-1", ["1", "1"]);
    res.end();
  });

  it("[Promise] multi header support for api gateway", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });
    res.setHeader("x-custom-1", ["1", "1"]);
    res.end();

    return responsePromise.then(response => {
      expect(response.multiValueHeaders).toEqual({
        "x-custom-1": ["1", "1"]
      });
    });
  });

  it("setHeader + removeHeader", done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.multiValueHeaders).toEqual({
          "x-custom-2": ["2"]
        });
        done();
      }
    );
    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.removeHeader("x-custom-1");
    res.end();
  });

  it("[Promise] setHeader + removeHeader", () => {
    expect.assertions(1);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });
    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");
    res.removeHeader("x-custom-1");
    res.end();

    return responsePromise.then(response => {
      expect(response.multiValueHeaders).toEqual({
        "x-custom-2": ["2"]
      });
    });
  });

  it("getHeader/s", () => {
    const { res } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });
    res.setHeader("x-custom-1", "1");
    res.setHeader("x-custom-2", "2");

    expect(res.getHeader("x-custom-1")).toEqual("1");
    expect(res.getHeaders()).toEqual({
      "x-custom-1": "1",
      "x-custom-2": "2"
    });
  });

  it(`res.write('ok')`, done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.isBase64Encoded).toEqual(false);
        expect(result.body).toEqual("ok");
        done();
      }
    );
    res.write("ok");
    res.end();
  });

  it(`[Promise] res.write('ok')`, () => {
    expect.assertions(2);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });
    res.write("ok");
    res.end();

    return responsePromise.then(response => {
      expect(response.isBase64Encoded).toEqual(false);
      expect(response.body).toEqual("ok");
    });
  });

  it(`res.end('ok')`, done => {
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.isBase64Encoded).toEqual(false);
        expect(result.body).toEqual("ok");
        done();
      }
    );
    res.end("ok");
  });

  it(`[Promise] res.end('ok')`, () => {
    expect.assertions(2);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });
    res.end("ok");

    return responsePromise.then(response => {
      expect(response.isBase64Encoded).toEqual(false);
      expect(response.body).toEqual("ok");
    });
  });

  it("req.pipe(res)", done => {
    const { req, res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.isBase64Encoded).toEqual(false);
        expect(result.body).toEqual("ok");
        done();
      }
    );

    res.end("ok");
  });

  it("[Promise] req.pipe(res)", () => {
    expect.assertions(2);

    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.end("ok");

    return responsePromise.then(response => {
      expect(response.isBase64Encoded).toEqual(false);
      expect(response.body).toEqual("ok");
    });
  });

  it("base64 support", done => {
    process.env.BINARY_SUPPORT = "yes";
    const { res } = create(
      {
        requestContext: {
          path: "/"
        },
        headers: {}
      },
      (err, result) => {
        expect(err).toBe(null);
        expect(result.body).toEqual(Buffer.from("ok").toString("base64"));
        expect(result.isBase64Encoded).toEqual(true);
        done();
      }
    );
    res.end("ok");
  });

  it("[Promise] base64 support", () => {
    expect.assertions(2);

    process.env.BINARY_SUPPORT = "yes";
    const { res, responsePromise } = create({
      requestContext: {
        path: "/"
      },
      headers: {}
    });

    res.end("ok");

    return responsePromise.then(response => {
      expect(response.body).toEqual(Buffer.from("ok").toString("base64"));
      expect(response.isBase64Encoded).toEqual(true);
    });
  });
});
