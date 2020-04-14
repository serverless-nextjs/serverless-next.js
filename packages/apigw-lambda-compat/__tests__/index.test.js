const compat = require("./..");
const compatLayer = require("../lib/compatLayer");

jest.mock("../lib/compatLayer");

describe("next-aws-lambda", () => {
  it("passes request and response to next page", () => {
    const event = { foo: "bar" };
    const callback = () => {};
    const context = {};

    // Mock due to mismatched Function types
    // https://github.com/facebook/jest/issues/6329
    mockRender = jest.fn();
    mockDefault = jest.fn();
    const page = {
      render: (...args) => mockRender(...args),
      default: (...args) => mockDefault(...args)
    };
    const req = {};
    const res = {};

    compatLayer.mockReturnValueOnce({
      req,
      res
    });

    compat(page)(event, context, callback);

    expect(mockRender).toBeCalledWith(req, res);
    expect(mockDefault).not.toBeCalled();
  });

  it("passes request and response to next api", () => {
    const event = { foo: "bar" };
    const callback = () => {};
    const context = {};

    // Mock due to mismatched Function types
    // https://github.com/facebook/jest/issues/6329
    mockDefault = jest.fn();
    const page = {
      default: (...args) => mockDefault(...args)
    };
    const req = {};
    const res = {};

    compatLayer.mockReturnValueOnce({
      req,
      res
    });

    compat(page)(event, context, callback);

    expect(mockDefault).toBeCalledWith(req, res);
  });

  it("supports async signature", () => {
    expect.assertions(1);

    const event = { foo: "bar" };
    const context = {};
    const page = {
      render: () => {}
    };
    const response = {
      statusCode: 200
    };
    compatLayer.mockReturnValue({
      responsePromise: Promise.resolve(response)
    });

    const responsePromise = compat(page)(event, context);

    return responsePromise.then(result => {
      expect(result).toEqual(response);
    });
  });
});
