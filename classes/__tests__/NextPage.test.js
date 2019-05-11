const path = require("path");
const NextPage = require("../NextPage");
const PluginBuildDir = require("../PluginBuildDir");

describe("NextPage", () => {
  describe("#constructor", () => {
    it("sets a pagePath", () => {
      const pagePath = `${PluginBuildDir.BUILD_DIR_NAME}/home.js`;
      const page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });

      expect(page.pagePath).toEqual(pagePath);
    });
  });

  describe("Simple page", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = path.join(buildDir, "admin.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    it("returns pageCompatPath", () => {
      expect(page.pageCompatPath).toEqual(
        path.join(buildDir, "admin.compat.js")
      );
    });

    it("returns pageOriginalPath", () => {
      expect(page.pageOriginalPath).toEqual(
        path.join(buildDir, "admin.original.js")
      );
    });

    it("returns pageDir", () => {
      expect(page.pageDir).toEqual(buildDir);
    });

    it("returns pageName", () => {
      expect(page.pageName).toEqual("admin");
    });

    it("returns pageHandler", () => {
      expect(page.pageHandler).toEqual(
        `${PluginBuildDir.BUILD_DIR_NAME}/admin.render`
      );
    });

    it("returns pageFunctionName", () => {
      expect(page.functionName).toEqual("adminPage");
    });

    it("returns pageId", () => {
      expect(page.pageId).toEqual("admin");
    });

    describe("#serverlessFunction", () => {
      it("returns function name", () => {
        const pageFunction = page.serverlessFunction;
        expect(pageFunction.adminPage).toBeDefined();
      });

      it("returns function handler", () => {
        const { handler } = page.serverlessFunction.adminPage;
        expect(handler).toEqual(`${buildDir}/admin.render`);
      });

      it("returns 2 http events", () => {
        const { events } = page.serverlessFunction.adminPage;
        expect(events).toHaveLength(2);
      });

      it("returns function http GET event", () => {
        const { events } = page.serverlessFunction.adminPage;

        const httpEvent = events[0].http;

        expect(httpEvent.path).toEqual("admin");
        expect(httpEvent.method).toEqual("get");
      });

      it("returns function http HEAD event", () => {
        const { events } = page.serverlessFunction.adminPage;

        const httpEvent = events[1].http;

        expect(httpEvent.path).toEqual("admin");
        expect(httpEvent.method).toEqual("head");
      });

      describe("When pageConfig override is provided", () => {
        it("creates identical HEAD route for custom GET route", () => {
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

          const pageWithCustomConfig = new NextPage(pagePath, {
            serverlessFunctionOverrides,
            routes: []
          });

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

        it("overrides serverlessFunction with provided pageConfig", () => {
          const serverlessFunctionOverrides = { foo: "bar" };

          const pageWithCustomConfig = new NextPage(pagePath, {
            serverlessFunctionOverrides,
            routes: []
          });

          expect(pageWithCustomConfig.serverlessFunction.adminPage.foo).toBe(
            "bar"
          );
        });

        it("doesn't change handler with provided pageConfig", () => {
          const serverlessFunctionOverrides = { handler: "invalid/handler" };

          const pageWithCustomConfig = new NextPage(pagePath, {
            serverlessFunctionOverrides,
            routes: []
          });

          expect(
            pageWithCustomConfig.serverlessFunction.adminPage.handler
          ).toBe(pageWithCustomConfig.pageHandler);
        });

        it("doesn't change runtime with provided pageConfig", () => {
          const serverlessFunctionOverrides = { runtime: "python2.7" };

          const pageWithCustomConfig = new NextPage(pagePath, {
            serverlessFunctionOverrides,
            routes: []
          });

          expect(
            pageWithCustomConfig.serverlessFunction.adminPage.runtime
          ).toBe(undefined);
        });
      });
    });
  });

  describe("When is the index page", () => {
    const buildDir = PluginBuildDir.BUILD_DIR_NAME;
    const pagePath = path.join(buildDir, "index.js");
    let page;

    beforeEach(() => {
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    it("returns pageId", () => {
      expect(page.pageId).toEqual("index");
    });

    describe("#serverlessFunction", () => {
      it("returns http GET event with path /", () => {
        const { events } = page.serverlessFunction.indexPage;

        const httpEvent = events[0].http;
        expect(httpEvent.method).toEqual("get");
        expect(httpEvent.path).toEqual("/");
      });

      it("returns http HEAD event with path /", () => {
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
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    describe("#serverlessFunction", () => {
      it("should name the function notFoundErrorPage", () => {
        expect(page.serverlessFunction.notFoundErrorPage).toBeDefined();
      });

      it("returns two events", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;
        expect(events).toHaveLength(2);
      });

      it("returns http event path /{proxy+} with GET method", () => {
        const { events } = page.serverlessFunction.notFoundErrorPage;

        const httpGet = events[0].http;

        expect(httpGet.path).toEqual("/{proxy+}");
        expect(httpGet.method).toEqual("get");
      });

      it("returns http event path /{proxy+} with HEAD method", () => {
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
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    it("returns pageId", () => {
      expect(page.pageId).toEqual("categories/fridge/fridges");
    });

    describe("#serverlessFunction", () => {
      it("returns URI path matching subdirectories", () => {
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
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    it("returns posix pageHandler", () => {
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
      page = new NextPage(pagePath, {
        serverlessFunctionOverrides: {},
        routes: []
      });
    });

    it("returns pageHandler", () => {
      expect(page.pageHandler).toEqual(
        `app/${PluginBuildDir.BUILD_DIR_NAME}/admin.render`
      );
    });

    it("returns pageRoute", () => {
      expect(page.pageRoute).toEqual("admin");
    });

    it("returns pageId", () => {
      expect(page.pageId).toEqual("admin");
    });
  });

  describe("When custom routes are provided", () => {
    let pageWithCustomRoutes;

    beforeEach(() => {
      pageWithCustomRoutes = new NextPage(
        path.join(PluginBuildDir.BUILD_DIR_NAME, "foo.js"),
        {
          routes: [
            {
              path: "/custom/path/to/foo"
            },
            {
              path: "/another/custom/path/to/foo"
            }
          ]
        }
      );
    });

    it("sets http GET and HEAD events for the route given", () => {
      const { events } = pageWithCustomRoutes.serverlessFunction.fooPage;
      expect(events).toHaveLength(4);

      const httpGetOne = events[0].http;
      const httpGetTwo = events[1].http;
      const httpHeadOne = events[2].http;
      const httpHeadTwo = events[3].http;

      expect(httpGetOne.method).toBe("get");
      expect(httpHeadOne.method).toBe("head");
      expect(httpGetOne.path).toBe("/custom/path/to/foo");
      expect(httpHeadOne.path).toBe("/custom/path/to/foo");

      expect(httpGetTwo.method).toBe("get");
      expect(httpHeadTwo.method).toBe("head");
      expect(httpGetTwo.path).toBe("/another/custom/path/to/foo");
      expect(httpHeadTwo.path).toBe("/another/custom/path/to/foo");
    });
  });
});
