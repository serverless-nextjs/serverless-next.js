import { PrerenderManifest } from "next/dist/build";
import {
  handleFallback,
  PageManifest,
  prepareBuildManifests,
  routeDefault,
  RoutesManifest
} from "../../src";
import { toRequest } from "../../src/handle/request";
import { mockEvent } from "./utils";

describe("Fallback handler", () => {
  let pagesManifest: { [key: string]: string };
  let manifest: PageManifest;
  let prerenderManifest: PrerenderManifest;
  let routesManifest: RoutesManifest;
  let getPage: any;

  beforeAll(async () => {
    prerenderManifest = {
      version: 3,
      notFoundRoutes: [],
      routes: {
        "/ssg": {
          initialRevalidateSeconds: 10,
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
        },
        "/fallback-blocking/[slug]": {
          routeRegex: "unused",
          dataRoute: "unused",
          dataRouteRegex: "unused",
          fallback: null
        },
        "/no-fallback/[slug]": {
          routeRegex: "unused",
          dataRoute: "unused",
          dataRouteRegex: "unused",
          fallback: false
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
          destination: "/fallback/:slug"
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
      "/fallback-blocking/[slug]": "pages/fallback-blocking/[slug].js"
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
  });

  beforeEach(() => {
    jest.spyOn(console, "error").mockReturnValueOnce();
    getPage = jest.fn();
  });

  describe("Non-dynamic", () => {
    it.each`
      uri                   | file
      ${"/"}                | ${"pages/404.html"}
      ${"/ssg"}             | ${"pages/404.html"}
      ${"/not/found"}       | ${"pages/404.html"}
      ${"/rewrite-ssg"}     | ${"pages/404.html"}
      ${"/redirect-simple"} | ${"pages/404.html"}
    `("Routes static route $uri to file $file", async ({ uri, file }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual(file);
      }
    });

    it.each`
      uri                                     | file
      ${"/_next/data/test-build-id/ssg.json"} | ${"pages/404.html"}
    `("Routes static data route $uri to file $file", async ({ uri, file }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual(file);
      }
    });

    it.each`
      uri       | page
      ${"/ssr"} | ${"pages/ssr.js"}
    `("Routes SSR route $uri to page $page", async ({ uri, page }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith(page);
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual("pages/500.html");
      }
    });
  });

  describe("Dynamic", () => {
    it.each`
      uri                    | file
      ${"/foo"}              | ${"pages/404.html"}
      ${"/html/bar"}         | ${"pages/404.html"}
      ${"/rewrite-external"} | ${"pages/404.html"}
      ${"/fallback/new"}     | ${"pages/fallback/[slug].html"}
      ${"/rewrite-path/new"} | ${"pages/fallback/[slug].html"}
    `("Routes static page $uri to file $file", async ({ uri, file }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual(file);
      }
    });

    it.each`
      uri                                                 | file
      ${"/_next/data/test-build-id/not-found.json"}       | ${"pages/404.html"}
      ${"/_next/data/test-build-id/no-fallback/new.json"} | ${"pages/404.html"}
      ${"/_next/data/not-build-id/fallback/new.json"}     | ${"pages/404.html"}
    `("Routes static data route $uri to file $file", async ({ uri, file }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual(file);
      }
    });

    it.each`
      uri                         | page
      ${"/fallback-blocking/new"} | ${"pages/fallback-blocking/[slug].js"}
    `(
      "Routes fallback blocking route $uri to page $page",
      async ({ uri, page }) => {
        const event = mockEvent(uri);
        const request = toRequest(event);
        const route = await handleFallback(
          event,
          await routeDefault(
            request,
            manifest,
            prerenderManifest,
            routesManifest
          ),
          manifest,
          routesManifest,
          getPage
        );

        expect(getPage).toHaveBeenCalledWith(page);
        expect(route).toBeTruthy();
        if (route) {
          expect(route.isStatic).toBeTruthy();
          expect((route as any).file).toEqual("pages/500.html");
        }
      }
    );

    it.each`
      uri                                                       | page
      ${"/_next/data/test-build-id/fallback/new.json"}          | ${"pages/fallback/[slug].js"}
      ${"/_next/data/test-build-id/fallback-blocking/new.json"} | ${"pages/fallback-blocking/[slug].js"}
    `(
      "Routes fallback data route $uri to page $page",
      async ({ uri, page }) => {
        const event = mockEvent(uri);
        const request = toRequest(event);
        const route = await handleFallback(
          event,
          await routeDefault(
            request,
            manifest,
            prerenderManifest,
            routesManifest
          ),
          manifest,
          routesManifest,
          getPage
        );

        expect(getPage).toHaveBeenCalledWith(page);
        expect(route).toBeTruthy();
        if (route) {
          expect(route.isStatic).toBeTruthy();
          expect((route as any).file).toEqual("pages/500.html");
        }
      }
    );
  });

  it.each`
    uri                                              | page
    ${"/_next/data/test-build-id/fallback/new.json"} | ${"pages/fallback/[slug].js"}
  `(
    "Returns 404 if $uri fallback returns notFound: true",
    async ({ uri, page }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const renderReqToHTML = jest.fn(() => ({
        renderOpts: { isNotFound: true }
      }));
      getPage.mockReturnValueOnce({ renderReqToHTML });
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith(page);
      expect(renderReqToHTML).toHaveBeenCalled();
      expect(route).toBeFalsy();
      expect(event.res.statusCode).toEqual(404);
    }
  );

  it.each`
    uri                         | page
    ${"/fallback-blocking/404"} | ${"pages/fallback-blocking/[slug].js"}
  `(
    "Returns 404 page if $uri fallback returns notFound: true",
    async ({ uri, page }) => {
      const event = mockEvent(uri);
      const request = toRequest(event);
      const renderReqToHTML = jest.fn(() => ({
        renderOpts: { isNotFound: true }
      }));
      getPage.mockReturnValueOnce({ renderReqToHTML });
      const route = await handleFallback(
        event,
        await routeDefault(
          request,
          manifest,
          prerenderManifest,
          routesManifest
        ),
        manifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith(page);
      expect(renderReqToHTML).toHaveBeenCalled();
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect((route as any).file).toEqual("pages/404.html");
        expect((route as any).statusCode).toEqual(404);
      }
    }
  );
});
