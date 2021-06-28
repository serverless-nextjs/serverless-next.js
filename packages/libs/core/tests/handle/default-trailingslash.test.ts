import { PrerenderManifest } from "next/dist/build";
import {
  Event,
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";

const event = (url: string, headers?: { [key: string]: string }): Event => {
  return {
    req: {
      headers: headers ?? {},
      url
    } as any,
    res: {
      end: jest.fn(),
      setHeader: jest.fn()
    } as any,
    responsePromise: new Promise(() => ({}))
  };
};

describe("Default handler (trailing slash)", () => {
  let pagesManifest: { [key: string]: string };
  let manifest: PageManifest;
  let prerenderManifest: PrerenderManifest;
  let routesManifest: RoutesManifest;
  let getPage: any;
  let consoleError: any;

  beforeAll(async () => {
    prerenderManifest = {
      version: 3,
      notFoundRoutes: [],
      routes: {
        "/ssg": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        }
      },
      dynamicRoutes: {},
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
      "/ssr": "pages/ssr.js",
      "/ssg": "pages/ssg.js"
    };
    const buildId = "test-build-id";
    const publicFiles = ["favicon.ico"];
    const manifests = await prepareBuildManifests(
      {
        buildId,
        domainRedirects: { "www.example.com": "https://example.com" }
      },
      {
        trailingSlash: true
      },
      routesManifest,
      pagesManifest,
      prerenderManifest,
      publicFiles
    );
    manifest = manifests.pageManifest;
  });

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockReturnValueOnce();
    getPage = jest.fn();
  });

  describe("Public file", () => {
    it.each`
      uri
      ${"/favicon.ico"}
    `("Routes $uri to public file", async ({ uri }) => {
      const route = await handleDefault(
        event(uri),
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
      uri                | file
      ${"/"}             | ${"pages/index.html"}
      ${"/ssg/"}         | ${"pages/ssg.html"}
      ${"/not/found/"}   | ${"pages/404.html"}
      ${"/rewrite-ssg/"} | ${"pages/ssg.html"}
    `("Routes static page $uri to file $file", async ({ uri, file }) => {
      const route = await handleDefault(
        event(uri),
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
        event(uri),
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
      ${"/ssr/"}                              | ${"pages/ssr.js"}
      ${"/_next/data/test-build-id/ssr.json"} | ${"pages/ssr.js"}
      ${"/rewrite-ssr/"}                      | ${"pages/ssr.js"}
      ${"/rewrite-query/test/"}               | ${"pages/ssr.js"}
    `("Routes SSR request $uri to page $page", async ({ uri, page }) => {
      const route = await handleDefault(
        event(uri),
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

  describe("Redirects", () => {
    it.each`
      uri                           | code   | destination
      ${"/ssg"}                     | ${308} | ${"/ssg/"}
      ${"/favicon.ico/"}            | ${308} | ${"/favicon.ico"}
      ${"/redirect-simple/"}        | ${307} | ${"/redirect-target"}
      ${"/redirect/test/"}          | ${308} | ${"/redirect-target/test"}
      ${"/redirect-query/?key=val"} | ${307} | ${"/redirect-target?key=val&foo=bar"}
    `(
      "Redirects $uri to $destination with code $code",
      async ({ code, destination, uri }) => {
        const e = event(uri);
        const route = await handleDefault(
          e,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        expect(route).toBeFalsy();
        expect(e.res.statusCode).toEqual(code);
        expect(e.res.setHeader).toHaveBeenCalledWith("Location", destination);
        expect(e.res.end).toHaveBeenCalled();
      }
    );

    it.each`
      uri               | code   | destination
      ${"/"}            | ${308} | ${"https://example.com/"}
      ${"/path/"}       | ${308} | ${"https://example.com/path/"}
      ${"/path/?query"} | ${308} | ${"https://example.com/path/?query"}
    `(
      "Redirects www.example.com$uri to $destination with code $code",
      async ({ code, destination, uri }) => {
        const e = event(uri, { Host: "www.example.com" });
        const route = await handleDefault(
          e,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        expect(route).toBeFalsy();
        expect(e.res.statusCode).toEqual(code);
        expect(e.res.setHeader).toHaveBeenCalledWith("Location", destination);
        expect(e.res.end).toHaveBeenCalled();
      }
    );
  });

  describe("External rewrite", () => {
    it.each`
      uri                     | path
      ${"/rewrite-external/"} | ${"https://ext.example.com"}
    `("Returns external rewrite from $uri to $path", async ({ path, uri }) => {
      const e = event(uri);
      const route = await handleDefault(
        e,
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
});
