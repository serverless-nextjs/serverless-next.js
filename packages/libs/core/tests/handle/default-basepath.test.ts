import { PrerenderManifest } from "next/dist/build";
import {
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";
import { mockEvent } from "./utils";

describe("Default handler (basepath)", () => {
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
        "/": {
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
      basePath: "/base",
      headers: [],
      redirects: [
        {
          source: "/base/redirect-simple",
          destination: "/base/redirect-target",
          statusCode: 307
        },
        {
          source: "/base/redirect/:dynamic",
          destination: "/base/redirect-target/:dynamic",
          statusCode: 308
        }
      ],
      rewrites: []
    };
    pagesManifest = {
      "/": "pages/index.js",
      "/404": "pages/404.html",
      "/500": "pages/500.html",
      "/html": "pages/html.html",
      "/[root]": "pages/[root].html",
      "/html/[page]": "pages/html/[page].html",
      "/ssr": "pages/ssr.js",
      "/ssr/[id]": "pages/ssr/[id].js",
      "/fallback/[slug]": "pages/fallback/[slug].js"
    };
    const buildId = "test-build-id";
    const publicFiles = ["favicon.ico", "name with spaces.txt"];
    const manifests = await prepareBuildManifests(
      { buildId, domainRedirects: {} },
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

  describe("Public file", () => {
    it.each`
      uri                                 | file
      ${"/base/favicon.ico"}              | ${"/favicon.ico"}
      ${"/base/name%20with%20spaces.txt"} | ${"/name%20with%20spaces.txt"}
    `("Routes $uri to public file", async ({ file, uri }) => {
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
        expect(route.file).toEqual(file);
      }
    });
  });

  describe("Non-dynamic", () => {
    it.each`
      uri                  | file
      ${"/base"}           | ${"pages/index.html"}
      ${"/base/html"}      | ${"pages/html.html"}
      ${"/base/not/found"} | ${"pages/404.html"}
      ${"/html"}           | ${"pages/404.html"}
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
      uri                                            | file
      ${"/base/_next/data/test-build-id.json"}       | ${"/_next/data/test-build-id/index.json"}
      ${"/base/_next/data/test-build-id/index.json"} | ${"/_next/data/test-build-id/index.json"}
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
      uri                                          | page
      ${"/base/ssr"}                               | ${"pages/ssr.js"}
      ${"/base/_next/data/test-build-id/ssr.json"} | ${"pages/ssr.js"}
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
      }
    });
  });

  describe("Dynamic", () => {
    it.each`
      uri                     | file
      ${"/base/foo"}          | ${"pages/[root].html"}
      ${"/base/html/bar"}     | ${"pages/html/[page].html"}
      ${"/base/fallback/new"} | ${"pages/fallback/new.html"}
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
      uri                                                   | file
      ${"/base/_next/data/test-build-id/fallback/new.json"} | ${"/_next/data/test-build-id/fallback/new.json"}
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
      uri                                            | page
      ${"/base/ssr/1"}                               | ${"pages/ssr/[id].js"}
      ${"/base/_next/data/test-build-id/ssr/1.json"} | ${"pages/ssr/[id].js"}
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
      }
    });
  });

  describe("Redirect", () => {
    it.each`
      uri                        | code   | destination
      ${"/base/ssg/"}            | ${308} | ${"/base/ssg"}
      ${"/base/favicon.ico/"}    | ${308} | ${"/base/favicon.ico"}
      ${"/base/redirect-simple"} | ${307} | ${"/base/redirect-target"}
      ${"/base/redirect/test"}   | ${308} | ${"/base/redirect-target/test"}
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
  });
});
