const create = require("../index");

describe("Response Tests", () => {
  it("statusCode writeHead 404", () => {
    expect.assertions(1);

    const {responsePromise, res} = create({
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

    const {res, responsePromise} = create({
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

    const {res, responsePromise} = create({
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

  it.skip("setHeader", done => {
    const {res, responsePromise} = create({
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
});
