const path = require("path");
const NextPage = require("../NextPage");

describe("NextPage", () => {
  describe("#constructor", () => {
    it("should set a pagePath", () => {
      const pagePath = "sls-next-build/home.js";
      const page = new NextPage(pagePath);

      expect(page.pagePath).toEqual(pagePath);
    });
  });

  describe("When is the index page", () => {
    const buildDir = "sls-next-build";
    const pagePath = path.join(buildDir, "index.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should return function http event path /", () => {
        const { events } = page.serverlessFunction.indexPage;

        expect(events).toHaveLength(1);

        const httpEvent = events[0].http;
        expect(httpEvent.path).toEqual("/");
      });
    });
  });

  describe("When is the _error page", () => {
    const buildDir = "sls-next-build";
    const pagePath = path.join(buildDir, "_error.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should name the function notFoundErrorPage", () => {
        expect(page.serverlessFunction.notFoundErrorPage).toBeDefined();
      });

      it("should return function http event path /{proxy+}", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;

        expect(events).toHaveLength(1);

        const httpEvent = events[0].http;
        expect(httpEvent.path).toEqual("/{proxy+}");
      });
    });
  });

  describe("When is a nested page", () => {
    const buildDir = "sls-next-build";
    const pagePath = path.join(buildDir, "categories/fridge/fridges.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should have URI path matching subdirectories", () => {
        const { events } = page.serverlessFunction.fridgesPage;

        expect(events).toHaveLength(1);

        const httpEvent = events[0].http;

        expect(httpEvent.path).toEqual("categories/fridge/fridges");
        expect(httpEvent.method).toEqual("get");
      });
    });
  });

  describe("When pagePath has win format", () => {
    const buildDir = "sls-next-build";
    const pagePath = `${buildDir}\\admin.js`;
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    it("should return posix pageHandler", () => {
      expect(page.pageHandler).toEqual("sls-next-build/admin.render");
    });
  });

  describe("When the build directory is a subdirectory", () => {
    const buildDir = path.join("app", "sls-next-build");
    const pagePath = path.join(buildDir, "admin.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    it("should return pageHandler", () => {
      expect(page.pageHandler).toEqual("app/sls-next-build/admin.render");
    });

    it("should return pageRoute", () => {
      expect(page.pageRoute).toEqual("admin");
    });
  });

  describe("When a new instance is created", () => {
    const buildDir = "sls-next-build";
    const pagePath = `${buildDir}/admin.js`;
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    it("should have pageCompatPath", () => {
      expect(page.pageCompatPath).toEqual(
        path.join(buildDir, "admin.compat.js")
      );
    });

    it("should return pageOriginalPath", () => {
      expect(page.pageOriginalPath).toEqual(
        path.join(buildDir, "admin.original.js")
      );
    });

    it("should return pageDir", () => {
      expect(page.pageDir).toEqual(buildDir);
    });

    it("should return pageName", () => {
      expect(page.pageName).toEqual("admin");
    });

    it("should return pageHandler", () => {
      expect(page.pageHandler).toEqual("sls-next-build/admin.render");
    });

    it("should return pageFunctionName", () => {
      expect(page.functionName).toEqual("adminPage");
    });

    describe("#serverlessFunction", () => {
      it("should return function name", () => {
        const pageFunction = page.serverlessFunction;
        expect(pageFunction.adminPage).toBeDefined();
      });

      it("should return function handler", () => {
        const { handler } = page.serverlessFunction.adminPage;
        expect(handler).toEqual(`${buildDir}/admin.render`);
      });

      it("should return function http event", () => {
        const { events } = page.serverlessFunction.adminPage;

        expect(events).toHaveLength(1);

        const httpEvent = events[0].http;

        expect(httpEvent.path).toEqual("admin");
        expect(httpEvent.method).toEqual("get");
      });

      it("should override serverlessFunction with provided pageConfig", () => {
        const serverlessFunctionOverrides = { foo: "bar" };

        const pageWithCustomConfig = new NextPage(
          pagePath,
          serverlessFunctionOverrides
        );

        expect(pageWithCustomConfig.serverlessFunction.adminPage.foo).toBe(
          "bar"
        );
      });

      it("should NOT change handler with provided pageConfig", () => {
        const serverlessFunctionOverrides = { handler: "invalid/handler" };

        const pageWithCustomConfig = new NextPage(
          pagePath,
          serverlessFunctionOverrides
        );

        expect(pageWithCustomConfig.serverlessFunction.adminPage.handler).toBe(
          pageWithCustomConfig.pageHandler
        );
      });

      it("should NOT change runtime with provided pageConfig", () => {
        const serverlessFunctionOverrides = { runtime: "python2.7" };

        const pageWithCustomConfig = new NextPage(
          pagePath,
          serverlessFunctionOverrides
        );

        expect(pageWithCustomConfig.serverlessFunction.adminPage.runtime).toBe(
          undefined
        );
      });
    });
  });
});
