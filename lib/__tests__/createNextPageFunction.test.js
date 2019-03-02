const createNextPageFunction = require("../createNextPageFunction");

describe("createNextPageFunction", () => {
  describe("when createNextPageFunctions is called", () => {
    const pagesDir = "/path/to/next/build/serverless/pages";
    let pageFunction;

    beforeEach(() => {
      pageFunction = createNextPageFunction(`${pagesDir}/home.js`);
    });

    it("should return function handler", () => {
      const { handler } = pageFunction;
      expect(handler).toEqual(`${pagesDir}/home.render`);
    });

    it("should return function http event", () => {
      const { events } = pageFunction;
      expect(events).toHaveLength(1);
      const httpEvent = events[0].http;
      expect(httpEvent.path).toEqual("home");
      expect(httpEvent.method).toEqual("get");
    });
  });
});
