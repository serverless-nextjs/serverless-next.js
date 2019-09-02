const create = require("../compatLayer");

describe("compatLayer.request", () => {
  it("request url path", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      }
    });

    expect(req.url).toEqual("/");
  });

  it("request url path fallback", () => {
    const { req } = create({
      requestContext: {},
      path: "/"
    });

    expect(req.url).toEqual("/");
  });

  it("request url path with stage removed", () => {
    const { req } = create({
      requestContext: {
        stage: "dev",
        path: "/dev/"
      }
    });

    expect(req.url).toEqual("/");
  });

  it("querystring /?x=42", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        x: ["42"]
      }
    });

    expect(req.url).toEqual("/?x=42");
  });

  it("querystring /?x=åäö", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        x: ["åäö"]
      }
    });

    expect(req.url).toEqual("/?x=%C3%A5%C3%A4%C3%B6");
  });

  it("querystring /?x=õ", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        x: ["õ"]
      }
    });

    expect(req.url).toEqual("/?x=%C3%B5");
  });

  it("querystring with multiple values for same name /?x=1&x=2", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        x: ["1", "2"]
      }
    });

    expect(req.url).toEqual("/?x=1&x=2");
  });

  it("complicated querystring", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        url:
          "https://example.com/t/t?a=8&as=1&t=2&tk=1&url=https://example.com/õ",
        clickSource: "yes",
        category: "cat"
      }
    });

    expect(req.url).toEqual(
      "/?url=https%3A%2F%2Fexample.com%2Ft%2Ft%3Fa%3D8%26as%3D1%26t%3D2%26tk%3D1%26url%3Dhttps%3A%2F%2Fexample.com%2F%C3%B5&clickSource=yes&category=cat"
    );
  });

  it('event pathParameters { foo: "bar", bar: "baz" }', () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      pathParameters: {
        foo: "bar",
        bar: "baz"
      }
    });

    expect(req.url).toEqual("/?foo=bar&bar=baz");
  });

  it("event pathParameters and queryString", () => {
    const { req } = create({
      requestContext: {
        path: "/"
      },
      multiValueQueryStringParameters: {
        abc: "def"
      },
      pathParameters: {
        foo: "bar",
        bar: "baz"
      }
    });

    expect(req.url).toEqual("/?abc=def&foo=bar&bar=baz");
  });

  it("request method", () => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      httpMethod: "GET"
    });

    expect(req.method).toEqual("GET");
  });

  it("request headers", () => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      multiValueHeaders: {
        "x-cUstom-1": ["42"],
        "x-custom-2": ["43"]
      }
    });

    expect(req.headers["x-custom-1"]).toEqual("42");
    expect(req.getHeader("x-custom-1")).toEqual("42");
    expect(req.headers["x-custom-2"]).toEqual("43");
    expect(req.getHeader("x-custom-2")).toEqual("43");

    expect(req.getHeaders()).toEqual({
      "x-custom-1": "42",
      "x-custom-2": "43"
    });

    expect(req.rawHeaders).toEqual(["x-cUstom-1", "42", "x-custom-2", "43"]);
  });

  it("request headers with same name", () => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      multiValueHeaders: {
        "x-multiple-1": ["41", "42"]
      }
    });

    expect(req.headers["x-multiple-1"]).toEqual("41,42");
    expect(req.getHeaders()).toEqual({
      "x-multiple-1": "41,42"
    });

    expect(req.rawHeaders).toEqual([
      "x-multiple-1",
      "41",
      "x-multiple-1",
      "42"
    ]);
  });

  it("text body", done => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      body: "ok",
      headers: {}
    });

    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("ok");
      done();
    });
  });

  it("text base64 body", done => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      body: Buffer.from("ok").toString("base64"),
      isBase64Encoded: true,
      headers: {}
    });

    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("ok");
      done();
    });
  });

  it("text body with encoding", done => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      body: "åäöß",
      headers: {}
    });

    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("åäöß");
      done();
    });
  });

  it("connection", done => {
    const { req } = create({
      requestContext: {
        path: ""
      },
      headers: {}
    });

    expect(req.connection).toEqual({});
    done();
  });
});
