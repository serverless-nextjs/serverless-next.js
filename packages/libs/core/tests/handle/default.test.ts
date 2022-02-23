import jwt from "jsonwebtoken";
import { PrerenderManifest } from "next/dist/build";
import {
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";
import { mockEvent } from "./utils";

const previewModeCookies = {
  Cookie:
    "__prerender_bypass=foo;__next_preview_data=" +
    jwt.sign("foo", "test-sig-key")
};

describe("Default handler", () => {
  let pagesManifest: { [key: string]: string };
  let manifest: PageManifest;
  let v2HandlerManifest: PageManifest;
  let prerenderManifest: PrerenderManifest;
  let routesManifest: RoutesManifest;
  let getPage: any;
  let consoleError: any;

  beforeAll(async () => {
    prerenderManifest = {
      version: 3,
      notFoundRoutes: ["/fallback/404"],
      routes: {
        "/ssg": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/fallback/prerendered": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        }
      },
      dynamicRoutes: {
        "/fallback/[slug]": {
          routeRegex: "unused",
          dataRoute: "unused",
          dataRouteRegex: "unused",
          fallback: "/fallback/[slug].html"
        }
      },
      preview: {
        previewModeId: "test-id",
        previewModeEncryptionKey: "test-key",
        previewModeSigningKey: "test-sig-key"
      }
    };
    routesManifest = {
      basePath: "",
      headers: [
        {
          source: "/ssr",
          headers: [
            {
              key: "X-Test-Header",
              value: "value"
            }
          ]
        }
      ],
      redirects: [
        {
          source: "/redirect-simple",
          destination: "/redirect-target",
          statusCode: 307
        },
        {
          source: "/redirect/:dynamic",
          destination: "/redirect-target/:dynamic",
          statusCode: 308
        },
        {
          source: "/redirect-query",
          destination: "/redirect-target?foo=bar",
          statusCode: 307
        }
      ],
      rewrites: [
        {
          source: "/rewrite-ssg",
          destination: "/ssg"
        },
        {
          source: "/rewrite-ssr",
          destination: "/ssr"
        },
        {
          source: "/rewrite-path/:slug",
          destination: "/:slug"
        },
        {
          source: "/rewrite-query/:slug",
          destination: "/ssr"
        },
        {
          source: "/rewrite-external",
          destination: "https://ext.example.com"
        }
      ]
    };
    pagesManifest = {
      "/": "pages/index.html",
      "/404": "pages/404.html",
      "/500": "pages/500.html",
      "/[root]": "pages/[root].html",
      "/html/[page]": "pages/html/[page].html",
      "/ssr": "pages/ssr.js",
      "/ssr/[id]": "pages/ssr/[id].js",
      "/ssg": "pages/ssg.js",
      "/fallback/[slug]": "pages/fallback/[slug].js",
      "/api/preview": "pages/api/preview.js"
    };
    const buildId = "test-build-id";
    const publicFiles = ["favicon.ico", "name with spaces.txt"];
    const manifests = await prepareBuildManifests(
      {
        buildId,
        domainRedirects: { "www.example.com": "https://example.com" }
      },
      {},
      routesManifest,
      pagesManifest,
      prerenderManifest,
      publicFiles
    );
    manifest = manifests.pageManifest;
    const v2HandlerManifests = await prepareBuildManifests(
      {
        buildId,
        domainRedirects: { "www.example.com": "https://example.com" },
        useV2Handler: true
      },
      {},
      routesManifest,
      pagesManifest,
      prerenderManifest,
      publicFiles
    );
    v2HandlerManifest = v2HandlerManifests.pageManifest;
  });

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockReturnValueOnce();
    getPage = jest.fn();
    getPage.mockReturnValueOnce({ default: jest.fn() });
  });

  describe("Public file", () => {
    it.each`
      uri
      ${"/favicon.ico"}
      ${"/name%20with%20spaces.txt"}
    `("Routes $uri to public file", async ({ uri }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isPublicFile).toBeTruthy();
        expect(route.file).toEqual(uri);
      }
    });
  });

  describe("Non-dynamic", () => {
    it.each`
      uri               | file
      ${"/"}            | ${"pages/index.html"}
      ${"/ssg"}         | ${"pages/ssg.html"}
      ${"/not/found"}   | ${"pages/404.html"}
      ${"/rewrite-ssg"} | ${"pages/ssg.html"}
    `("Routes static page $uri to file $file", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });

    it.each`
      uri                                     | file
      ${"/_next/data/test-build-id/ssg.json"} | ${"/_next/data/test-build-id/ssg.json"}
    `("Routes static data route $uri to file $file", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });

    it.each`
      uri                                     | page
      ${"/ssg"}                               | ${"pages/ssg.js"}
      ${"/_next/data/test-build-id/ssg.json"} | ${"pages/ssg.js"}
    `(
      "Routes SSG request $uri to page $page in preview mode",
      async ({ uri, page }) => {
        const route = await handleDefault(
          mockEvent(uri, previewModeCookies),
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        expect(getPage).toHaveBeenCalledWith(page);

        // mocked getPage throws an error in render, so error page returned
        expect(route).toBeTruthy();
        if (route) {
          expect(route.isStatic).toBeTruthy();
          expect(route.file).toEqual("pages/500.html");
          expect(consoleError).toHaveBeenCalled();
        }
      }
    );

    it.each`
      uri                                     | page
      ${"/ssr"}                               | ${"pages/ssr.js"}
      ${"/_next/data/test-build-id/ssr.json"} | ${"pages/ssr.js"}
      ${"/rewrite-ssr"}                       | ${"pages/ssr.js"}
      ${"/rewrite-query/test?key=value"}      | ${"pages/ssr.js"}
    `("Routes SSR request $uri to page $page", async ({ uri, page }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith(page);

      // mocked getPage throws an error in render, so error page returned
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual("pages/500.html");
        expect(consoleError).toHaveBeenCalled();
      }
    });
  });

  describe("Dynamic", () => {
    it.each`
      uri                | file
      ${"/foo"}          | ${"pages/[root].html"}
      ${"/html/bar"}     | ${"pages/html/[page].html"}
      ${"/fallback/new"} | ${"pages/fallback/new.html"}
      ${"/fallback/404"} | ${"pages/404.html"}
      ${"/rewrite-path"} | ${"pages/[root].html"}
    `("Routes static page $uri to file $file", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });

    it.each`
      uri                                              | file
      ${"/_next/data/test-build-id/fallback/new.json"} | ${"/_next/data/test-build-id/fallback/new.json"}
      ${"/_next/data/test-build-id/fallback/404.json"} | ${"pages/404.html"}
      ${"/_next/data/test-build-id/not-found.json"}    | ${"pages/404.html"}
      ${"/_next/data/not-build-id/fallback/new.json"}  | ${"pages/404.html"}
    `("Routes static data route $uri to file $file", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });

    it.each`
      uri                                       | page
      ${"/ssr/1"}                               | ${"pages/ssr/[id].js"}
      ${"/_next/data/test-build-id/ssr/1.json"} | ${"pages/ssr/[id].js"}
    `("Routes SSR request $uri to page $page", async ({ uri, page }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith(page);

      // mocked getPage throws an error in render, so error page returned
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual("pages/500.html");
        expect(consoleError).toHaveBeenCalled();
      }
    });
  });

  describe("Headers", () => {
    it.each`
      uri
      ${"/ssr"}
    `("Sets headers for $uri", async ({ uri }) => {
      const event = mockEvent(uri);

      await handleDefault(
        event,
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(event.res.setHeader).toHaveBeenCalledWith(
        "X-Test-Header",
        "value"
      );
    });
  });

  describe("Redirects", () => {
    it.each`
      uri                          | code   | destination
      ${"/ssg/"}                   | ${308} | ${"/ssg"}
      ${"/favicon.ico/"}           | ${308} | ${"/favicon.ico"}
      ${"/redirect-simple"}        | ${307} | ${"/redirect-target"}
      ${"/redirect/test"}          | ${308} | ${"/redirect-target/test"}
      ${"/redirect-query?key=val"} | ${307} | ${"/redirect-target?key=val&foo=bar"}
    `(
      "Redirects $uri to $destination with code $code",
      async ({ code, destination, uri }) => {
        const event = mockEvent(uri);
        const route = await handleDefault(
          event,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        expect(route).toBeFalsy();
        expect(event.res.statusCode).toEqual(code);
        expect(event.res.setHeader).toHaveBeenCalledWith(
          "Location",
          destination
        );
        expect(event.res.end).toHaveBeenCalled();
      }
    );

    it.each`
      uri              | code   | destination
      ${"/"}           | ${308} | ${"https://example.com/"}
      ${"/path"}       | ${308} | ${"https://example.com/path"}
      ${"/path?query"} | ${308} | ${"https://example.com/path?query"}
    `(
      "Redirects www.example.com$uri to $destination with code $code",
      async ({ code, destination, uri }) => {
        const event = mockEvent(uri, { Host: "www.example.com" });
        const route = await handleDefault(
          event,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        expect(route).toBeFalsy();
        expect(event.res.statusCode).toEqual(code);
        expect(event.res.setHeader).toHaveBeenCalledWith(
          "Location",
          destination
        );
        expect(event.res.end).toHaveBeenCalled();
      }
    );
  });

  describe("External rewrite", () => {
    it.each`
      uri                    | path
      ${"/rewrite-external"} | ${"https://ext.example.com"}
    `("Returns external rewrite from $uri to $path", async ({ path, uri }) => {
      const event = mockEvent(uri);
      const route = await handleDefault(
        event,
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isExternal).toBeTruthy();
        expect((route as any).path).toEqual(path);
      }
    });
  });

  describe("API", () => {
    it.each`
      uri               | path
      ${"/api/preview"} | ${"pages/api/preview.js"}
    `(
      "Routes api request $uri to page $page with NodeNextRequest & NodeNextResponse",
      async ({ path, uri }) => {
        const event = mockEvent(uri);
        const route = await handleDefault(
          event,
          v2HandlerManifest,
          prerenderManifest,
          routesManifest,
          getPage
        );
        expect(route).toBeFalsy();
        expect(getPage).toHaveBeenCalledWith(path);
        expect((event.req as any).originalRequest).toBe(event.req);
        expect((event.res as any).originalResponse).toBe(event.res);
      }
    );

    it.each`
      uri               | path
      ${"/api/preview"} | ${"pages/api/preview.js"}
    `("Routes api request $uri to page $page", async ({ path, uri }) => {
      const event: any = mockEvent(uri);
      event.req.originalRequest = {};
      event.res.originalResponse = {};
      const route = await handleDefault(
        event,
        v2HandlerManifest,
        prerenderManifest,
        routesManifest,
        getPage
      );
      expect(route).toBeFalsy();
      expect(getPage).toHaveBeenCalledWith(path);
      expect((event.req as any).originalRequest).toBe(
        event.req.originalRequest
      );
      expect((event.res as any).originalResponse).toBe(
        event.res.originalResponse
      );
    });
  });
});
