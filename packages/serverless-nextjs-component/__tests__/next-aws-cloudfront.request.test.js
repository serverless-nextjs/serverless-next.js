const create = require("../next-aws-cloudfront");

describe("Request Tests", () => {
  it("request url path", () => {
    const { req } = create({
      request: {
        uri: "/"
      }
    });

    expect(req.url).toEqual("/");
  });

  it("querystring /?x=42", () => {
    const { req } = create({
      request: {
        uri: "/",
        querystring: "x=42"
      }
    });

    expect(req.url).toEqual("/?x=42");
  });

  // it("querystring /?x=åäö", () => {
  //   const {req} = create({
  //     request: {
  //       uri: "/",
  //       querystring: "x=åäö"
  //     }
  //   });

  //   expect(req.url).toEqual("/?x=%C3%A5%C3%A4%C3%B6");
  // });

  // it("querystring /?x=õ", () => {
  //   const {req} = create({
  //     request: {
  //       uri: "/",
  //       querystring: "x=õ"
  //     }
  //   });

  //   expect(req.url).toEqual("/?x=%C3%B5");
  // });

  // it("querystring with multiple values for same name /?x=1&x=2", () => {
  //   const {req} = create({
  //     request: {
  //       uri: "/",
  //       querystring: "x=1&x=2"
  //     }
  //   });

  //   expect(req.url).toEqual("/?x=1&x=2");
  // });

  // it("complicated querystring", () => {
  //   const { req } = create({
  //     request: {
  //       uri: "/",
  //       querystring: "a=8&as=1&t=2&tk=1&url=https://example.com/õ"
  //     }
  //   });

  //   expect(req.url).toEqual(
  //     "/?url=https%3A%2F%2Fexample.com%2Ft%2Ft%3Fa%3D8%26as%3D1%26t%3D2%26tk%3D1%26url%3Dhttps%3A%2F%2Fexample.com%2F%C3%B5&clickSource=yes&category=cat"
  //   );
  // });

  it("request method", () => {
    const { req } = create({
      request: {
        uri: "",
        method: "GET"
      }
    });

    expect(req.method).toEqual("GET");
  });

  it("request headers", () => {
    const { req } = create({
      request: {
        uri: "",
        headers: {
          "x-custom-1": {
            key: "x-cUstom-1",
            value: "42"
          },
          "x-custom-2": {
            key: "x-custom-2",
            value: "43"
          }
        }
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

  it("text body", done => {
    const { req } = create({
      request: {
        uri: "",
        body: {
          data: "ok"
        }
      }
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
      request: {
        uri: "",
        body: {
          encoding: "base64",
          data: Buffer.from("ok").toString("base64")
        },
        headers: {}
      }
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
      request: {
        uri: "",
        body: {
          data: "åäöß"
        },
        headers: {}
      }
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
      request: {
        uri: "",
        headers: {}
      }
    });

    expect(req.connection).toEqual({});
    done();
  });
});
