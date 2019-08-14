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
});
