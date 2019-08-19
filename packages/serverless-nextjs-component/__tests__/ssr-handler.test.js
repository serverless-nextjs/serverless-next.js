const compatLayer = require("next-aws-lambda");
const ssrHandler = require("../ssr-handler");

jest.mock("next-aws-lambda");
jest.mock(
  "../manifest.json",
  () => require("./fixtures/built-artifact/manifest.json"),
  { virtual: true }
);

const mockPageRequire = mockPagePath => {
  jest.mock(
    mockPagePath,
    () => require(`./fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("ssr handler tests", () => {
  it.each`
    inputUrlPath                            | expectedPage
    ${"/"}                                  | ${"pages/index.js"}
    ${"/xyz"}                               | ${"pages/[root].js"}
    ${"/customers/new"}                     | ${"pages/customers/new.js"}
    ${"/blog/123"}                          | ${"pages/blog/[id].js"}
    ${"/customers/batman/howtoactlikeabat"} | ${"pages/customers/[customer]/[post].js"}
  `(
    'renders path "$inputUrlPath" using page "$expectedPage"',
    ({ inputUrlPath, expectedPage }) => {
      const render = jest.fn();

      mockPageRequire(expectedPage);
      compatLayer.mockReturnValue(render);

      const event = { path: inputUrlPath };
      const context = {};
      const callback = () => {};

      ssrHandler(event, context, callback);

      expect(compatLayer).toBeCalledWith({ page: expectedPage });
      expect(render).toBeCalledWith(event, context, callback);
    }
  );
});
