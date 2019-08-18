const router = require("../router");
const compatLayer = require("next-aws-lambda");

const ssrHandler = require("../ssr-handler");

jest.mock("../router");
jest.mock("next-aws-lambda");

describe("ssr handler tests", () => {
  it("renders page using router and compat layer", async () => {
    const page = { render: () => {} };
    const event = {};
    const callback = () => {};
    const renderCallback = jest.fn();

    router.mockReturnValue(page);
    compatLayer.mockReturnValue(renderCallback);

    ssrHandler(event, {}, callback);

    expect(compatLayer).toBeCalledWith(page);
    expect(renderCallback).toBeCalledWith(event, callback);
  });
});
