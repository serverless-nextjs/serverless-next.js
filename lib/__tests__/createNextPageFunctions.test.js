const createNextPageFunctions = require("../createNextPageFunctions");

describe("createNextPageFunctions", () => {
  it("should return an empty array when no page handlers are passed", () => {
    expect.assertions(1);

    return createNextPageFunctions([]).then(functions => {
      expect(functions).toHaveLength(0);
    });
  });

  describe("when createNextPageFunctions is called", () => {
    const pagesDir = "/path/to/next/build/serverless/pages";
    let pageFunctions;

    beforeEach(() => {
      const pagePaths = [`${pagesDir}/home.js`];
      pageFunctionsPromise = createNextPageFunctions(pagePaths);

      return pageFunctionsPromise.then(functions => {
        pageFunctions = functions;
      });
    });

    it("should return one page function", () => {
      expect(pageFunctions).toHaveLength(1);
    });

    it("should return function handler", () => {
      const { handler } = pageFunctions[0];
      expect(handler).toEqual(`${pagesDir}/home.render`);
    });

    it("should return function http event", () => {
      const { events } = pageFunctions[0];
      expect(events).toHaveLength(1);
      const httpEvent = events[0].http;
      expect(httpEvent.path).toEqual("home");
      expect(httpEvent.method).toEqual("get");
    });
  });
});
