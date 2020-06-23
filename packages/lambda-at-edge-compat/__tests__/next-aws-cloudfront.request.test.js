const create = require("../next-aws-cloudfront");
const http = require("http");

const { SPECIAL_NODE_HEADERS } = create;

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
          host: [
            {
              key: "Host",
              value: "xyz.net"
            }
          ],
          "user-agent": [
            {
              key: "User-Agent",
              value: "mozilla"
            }
          ]
        }
      }
    });

    expect(req.headers["host"]).toEqual("xyz.net");
    expect(req.getHeader("host")).toEqual("xyz.net");
    expect(req.headers["user-agent"]).toEqual("mozilla");
    expect(req.getHeader("user-agent")).toEqual("mozilla");

    expect(req.getHeaders()).toEqual({
      host: "xyz.net",
      "user-agent": "mozilla"
    });

    expect(req.rawHeaders).toEqual([
      "Host",
      "xyz.net",
      "User-Agent",
      "mozilla"
    ]);
  });

  it("duplicates of special request headers are discarded", () => {
    SPECIAL_NODE_HEADERS.forEach((headerName) => {
      // user-agent -> uSER-AGENT
      const duplicateHeaderName =
        headerName.charAt(0) + headerName.substring(1).toUpperCase();

      const { req } = create({
        request: {
          uri: "",
          headers: {
            [headerName]: [
              {
                key: headerName,
                value: "headerValue"
              },
              {
                key: duplicateHeaderName,
                value: "hEaderValue"
              }
            ]
          }
        }
      });

      expect(req.headers[headerName]).toEqual("headerValue");
      expect(req.getHeader(headerName)).toEqual("headerValue");

      expect(req.getHeaders()).toEqual({
        [headerName]: "headerValue"
      });

      expect(req.rawHeaders).toEqual([
        headerName,
        "headerValue",
        duplicateHeaderName,
        "hEaderValue"
      ]);
    });
  });

  it("text body", (done) => {
    const { req } = create({
      request: {
        uri: "",
        body: {
          data: "ok"
        }
      }
    });

    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("ok");
      done();
    });
  });

  it("text base64 body", (done) => {
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

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("ok");
      done();
    });
  });

  it("text body with encoding", (done) => {
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

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      expect(data).toEqual("åäöß");
      done();
    });
  });

  it("connection", (done) => {
    const { req } = create({
      request: {
        uri: "",
        headers: {}
      }
    });

    expect(req.connection).toEqual({});
    done();
  });

  it("request preserve http.IncomingMessage.prototype property", () => {
    const exampleProperty = "I'm an example property";
    http.IncomingMessage.prototype.exampleProperty = exampleProperty;
    const { req } = create({
      request: {
        uri: ""
      }
    });

    expect(typeof req.exampleProperty !== "undefined").toEqual(true);
    expect(req.exampleProperty).toEqual(exampleProperty);
  });

  it("request preserve http.IncomingMessage.prototype function", () => {
    const exampleFunction = function () {
      return "I'm an example function.";
    };
    http.IncomingMessage.prototype.exampleFunction = exampleFunction;
    const { req } = create({
      request: {
        uri: ""
      }
    });

    expect(typeof req.exampleFunction === "function").toEqual(true);
    expect(req.exampleFunction()).toEqual(exampleFunction());
    expect(req.exampleFunction.toString()).toEqual(exampleFunction.toString());
  });
});
