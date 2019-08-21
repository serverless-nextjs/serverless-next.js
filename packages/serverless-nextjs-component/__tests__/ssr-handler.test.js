const compatLayer = require("next-aws-lambda");
const fs = require("fs");
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
    ${"/route/does/not/exist"}              | ${"pages/_error.js"}
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

  describe("static pages", () => {
    it("renders static HTML page", done => {
      mockPageRequire("pages/terms.html");

      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockImplementation((path, enc, cb) => cb(null, "<html>TERMS</html>"));

      const event = { path: "/terms" };
      const context = {};
      const callback = jest.fn(() => done());

      ssrHandler(event, context, callback);

      expect(callback).toBeCalledWith(null, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html"
        },
        body: "<html>TERMS</html>"
      });

      readFileSpy.mockRestore();
    });
  });
});
