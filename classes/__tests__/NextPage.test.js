const NextPage = require("../NextPage");

describe("NextPage", () => {
  describe("#constructor", () => {
    it("should set a pagePath", () => {
      const pagePath = "/build/serverless/pages/home.js";
      const page = new NextPage(pagePath);

      expect(page.pagePath).toEqual(pagePath);
    });

    it("should throw if pagePath is invalid", () => {
      const pagePath = "/build/foo/bar/home.js";
      expect(() => new NextPage(pagePath)).toThrow(
        "Invalid next page directory"
      );
    });
  });

  describe("#pageDir", () => {
    it("should return pageDir", () => {
      const pagesDir = "/build/serverless/pages";
      const pagePath = `${pagesDir}/admin.js`;
      const page = new NextPage(pagePath);

      expect(page.pageDir).toEqual(pagesDir);
    });
  });

  describe("#pageName", () => {
    it("should return pageName", () => {
      const pagePath = "/build/serverless/pages/admin.js";
      const page = new NextPage(pagePath);

      expect(page.pageName).toEqual("admin");
    });
  });

  describe("#pageHandler", () => {
    it("should return pageHandler", () => {
      const pagePath = "/build/serverless/pages/admin.js";
      const page = new NextPage(pagePath);

      expect(page.pageHandler).toEqual("/build/serverless/pages/admin.render");
    });
  });

  describe("#serverlessFunction", () => {
    const pagesDir = "/build/serverless/pages";
    let page;

    beforeEach(() => {
      const pagePath = `${pagesDir}/admin.js`;
      page = new NextPage(pagePath);
    });

    it("should return function handler", () => {
      const { handler } = page.serverlessFunction;
      expect(handler).toEqual(`${pagesDir}/admin.render`);
    });

    it("should return function http event", () => {
      const { events } = page.serverlessFunction;

      expect(events).toHaveLength(1);

      const httpEvent = events[0].http;

      expect(httpEvent.path).toEqual("admin");
      expect(httpEvent.method).toEqual("get");
    });
  });
});
