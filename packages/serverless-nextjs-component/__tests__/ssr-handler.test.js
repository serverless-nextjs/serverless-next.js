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
      expect.assertions(3);

      const render = jest.fn().mockReturnValue(
        Promise.resolve({
          statusCode: 200
        })
      );

      mockPageRequire(expectedPage);
      compatLayer.mockReturnValue(render);

      const event = { path: inputUrlPath };
      const context = {};

      return ssrHandler(event, context).then(response => {
        expect(compatLayer).toBeCalledWith({ page: expectedPage });
        expect(render).toBeCalledWith(event, context);
        expect(response).toEqual({
          statusCode: 200
        });
      });
    }
  );

  describe("static pages", () => {
    it("renders static HTML page", () => {
      expect.assertions(1);

      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockImplementation((path, enc, cb) => cb(null, "<html>TERMS</html>"));

      const event = { path: "/terms" };
      const context = {};

      return ssrHandler(event, context).then(response => {
        expect(response).toEqual({
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
});
