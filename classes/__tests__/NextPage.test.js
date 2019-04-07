const path = require("path");
const NextPage = require("../NextPage");
const PluginBuildDir = require("../PluginBuildDir");

describe("NextPage", () => {
  describe("#constructor", () => {
    it("should set a pagePath", () => {
      const pagePath = `${PluginBuildDir.BUILD_DIR_NAME}/home.js`;
      const page = new NextPage(pagePath);

      expect(page.pagePath).toEqual(pagePath);
    });
  });

  describe("When is the index page", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = path.join(buildDir, "index.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should have http GET event with path /", () => {
        const { events } = page.serverlessFunction.indexPage;

        const httpEvent = events[0].http;
        expect(httpEvent.method).toEqual("get");
        expect(httpEvent.path).toEqual("/");
      });

      it("should have http HEAD event with path /", () => {
        const { events } = page.serverlessFunction.indexPage;

        const httpEvent = events[1].http;
        expect(httpEvent.method).toEqual("head");
        expect(httpEvent.path).toEqual("/");
      });
    });
  });

  describe("When is the _error page", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = path.join(buildDir, "_error.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should name the function notFoundErrorPage", () => {
        expect(page.serverlessFunction.notFoundErrorPage).toBeDefined();
      });

      it("should return two events", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;
        expect(events).toHaveLength(2);
      });

      it("should return http event path /{proxy+} with GET method", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;

        const httpGet = events[0].http;

        expect(httpGet.path).toEqual("/{proxy+}");
        expect(httpGet.method).toEqual("get");
      });

      it("should return http event path /{proxy+} with HEAD method", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;

        const httpHead = events[1].http;

        expect(httpHead.path).toEqual("/{proxy+}");
        expect(httpHead.method).toEqual("head");
      });
    });
  });

  describe("When is a nested page", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = path.join(buildDir, "categories/fridge/fridges.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    describe("#serverlessFunction", () => {
      it("should have URI path matching subdirectories", () => {
        const { events } = page.serverlessFunction.fridgesPage;

        expect(events).toHaveLength(2);

        const httpGet = events[0].http;
        const httpHead = events[1].http;

        expect(httpGet.path).toEqual("categories/fridge/fridges");
        expect(httpGet.method).toEqual("get");
        expect(httpHead.path).toEqual("categories/fridge/fridges");
        expect(httpHead.method).toEqual("head");
      });
    });
  });

  describe("When pagePath has win format", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = `${buildDir}\\admin.js`;
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    it("should return posix pageHandler", () => {
      expect(page.pageHandler).toEqual(
        `${PluginBuildDir.BUILD_DIR_NAME}/admin.render`
      );
    });
  });

  describe("When the build directory is a subdirectory", () => {
    const buildDir = path.join("app", PluginBuildDir.BUILD_DIR_NAME);
    const pagePath = path.join(buildDir, "admin.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath);
    });

    it("should return pageHandler", () => {
      expect(page.pageHandler).toEqual(
        `app/${PluginBuildDir.BUILD_DIR_NAME}/admin.render`
      );
    });

    it("should return pageRoute", () => {
      expect(page.pageRoute).toEqual("admin");
    });
  });

  describe("When a new instance is created", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
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
      expect(page.pageHandler).toEqual(
        `${PluginBuildDir.BUILD_DIR_NAME}/admin.render`
      );
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

      it("should return 2 http events", () => {
        const { events } = page.serverlessFunction.adminPage;
        expect(events).toHaveLength(2);
      });

      it("should return function http GET event", () => {
        const { events } = page.serverlessFunction.adminPage;

        const httpEvent = events[0].http;

        expect(httpEvent.path).toEqual("admin");
        expect(httpEvent.method).toEqual("get");
      });

      it("should return function http HEAD event", () => {
        const { events } = page.serverlessFunction.adminPage;

        const httpEvent = events[1].http;

        expect(httpEvent.path).toEqual("admin");
        expect(httpEvent.method).toEqual("head");
      });

      describe("When pageConfig override is provided", () => {
        it("should create identical HEAD route for custom GET route", () => {
          const serverlessFunctionOverrides = {
            events: [
              {
                http: {
                  path: "admin/{id}",
                  request: {
                    parameters: {
                      id: true
                    }
                  }
                }
              }
            ]
          };

          const pageWithCustomConfig = new NextPage(
            pagePath,
            serverlessFunctionOverrides
          );

          const { events } = pageWithCustomConfig.serverlessFunction.adminPage;
          expect(events).toHaveLength(2);

          const httpGet = events[0].http;
          const httpHead = events[1].http;

          expect(httpGet.method).toBe("get");
          expect(httpHead.method).toBe("head");

          expect(httpGet.path).toBe("admin/{id}");
          expect(httpHead.path).toBe("admin/{id}");

          expect(httpGet.request.parameters.id).toBe(true);
          expect(httpHead.request.parameters.id).toBe(true);
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

          expect(
            pageWithCustomConfig.serverlessFunction.adminPage.handler
          ).toBe(pageWithCustomConfig.pageHandler);
        });

        it("should NOT change runtime with provided pageConfig", () => {
          const serverlessFunctionOverrides = { runtime: "python2.7" };

          const pageWithCustomConfig = new NextPage(
            pagePath,
            serverlessFunctionOverrides
          );

          expect(
            pageWithCustomConfig.serverlessFunction.adminPage.runtime
          ).toBe(undefined);
        });
      });
    });
  });
});
