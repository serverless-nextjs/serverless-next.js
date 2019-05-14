const compat = require("./..");
const compatLayer = require("../lib/compatLayer");

jest.mock("../lib/compatLayer");

describe("next-aws-lambda", () => {
  it("passes request and response to next page", () => {
    const event = { foo: "bar" };
    const callback = () => {};
    const context = {};

    const page = {
      render: jest.fn()
    };
    const req = {};
    const res = {};

    compatLayer.mockReturnValueOnce({
      req,
      res
    });

    compat(page)(event, context, callback);

    expect(page.render).toBeCalledWith(req, res);
  });
});
