import { PrerenderManifest } from "next/dist/build";
import {
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";
import { mockEvent } from "./utils";

describe("Default handler (basepath + i18n)", () => {
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
        "/en/404": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/fr/404": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/en/ssg": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/fr/ssg": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/en/fallback/prerendered": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/fr/fallback/prerendered": {
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
          source: "/base/:nextInternalLocale(en|fr)/redirect-simple",
          destination: "/base/:nextInternalLocale/redirect-target",
          statusCode: 307
        },
        {
          source: "/base/:nextInternalLocale(en|fr)/redirect/:dynamic",
          destination: "/base/:nextInternalLocale/redirect-target/:dynamic",
          statusCode: 308
        }
      ],
      rewrites: [],
      i18n: {
        defaultLocale: "en",
        locales: ["en", "fr"],
        localeDetection: false
      }
    };
    pagesManifest = {
      "/en": "pages/en.html",
      "/fr": "pages/fr.html",
      "/en/[root]": "pages/en/[root].html",
      "/fr/[root]": "pages/fr/[root].html",
      "/en/html/[page]": "pages/en/html/[page].html",
      "/fr/html/[page]": "pages/fr/html/[page].html",
      "/ssr": "pages/ssr.js",
      "/ssr/[id]": "pages/ssr/[id].js",
      "/ssg": "pages/ssg.js",
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

  describe("Non-dynamic", () => {
    it.each`
      uri                     | file
      ${"/base"}              | ${"pages/en.html"}
      ${"/base/ssg"}          | ${"pages/en/ssg.html"}
      ${"/base/not/found"}    | ${"pages/en/404.html"}
      ${"/not/found"}         | ${"pages/en/404.html"}
      ${"/base/en"}           | ${"pages/en.html"}
      ${"/base/en/ssg"}       | ${"pages/en/ssg.html"}
      ${"/base/en/not/found"} | ${"pages/en/404.html"}
      ${"/base/fr"}           | ${"pages/fr.html"}
      ${"/base/fr/ssg"}       | ${"pages/fr/ssg.html"}
      ${"/base/fr/not/found"} | ${"pages/fr/404.html"}
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
      uri                                             | file
      ${"/base/_next/data/test-build-id/ssg.json"}    | ${"/_next/data/test-build-id/en/ssg.json"}
      ${"/base/_next/data/test-build-id/en/ssg.json"} | ${"/_next/data/test-build-id/en/ssg.json"}
      ${"/base/_next/data/test-build-id/fr/ssg.json"} | ${"/_next/data/test-build-id/fr/ssg.json"}
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
      uri
      ${"/base/ssr"}
      ${"/base/en/ssr"}
      ${"/base/fr/ssr"}
      ${"/base/_next/data/test-build-id/ssr.json"}
    `("Routes SSR request $uri to pages/ssr.js", async ({ uri }) => {
      await expect(
        handleDefault(
          mockEvent(uri),
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        )
      ).rejects.toThrow(TypeError);

      expect(getPage).toHaveBeenCalledWith("pages/ssr.js");
    });
  });

  describe("Dynamic", () => {
    it.each`
      uri                        | file
      ${"/base/foo"}             | ${"pages/en/[root].html"}
      ${"/base/html/bar"}        | ${"pages/en/html/[page].html"}
      ${"/base/fallback/new"}    | ${"pages/en/fallback/new.html"}
      ${"/base/en/foo"}          | ${"pages/en/[root].html"}
      ${"/base/en/html/bar"}     | ${"pages/en/html/[page].html"}
      ${"/base/en/fallback/new"} | ${"pages/en/fallback/new.html"}
      ${"/base/fr/foo"}          | ${"pages/fr/[root].html"}
      ${"/base/fr/html/bar"}     | ${"pages/fr/html/[page].html"}
      ${"/base/fr/fallback/new"} | ${"pages/fr/fallback/new.html"}
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
      uri                                                      | file
      ${"/base/_next/data/test-build-id/fallback/new.json"}    | ${"/_next/data/test-build-id/en/fallback/new.json"}
      ${"/base/_next/data/test-build-id/en/fallback/new.json"} | ${"/_next/data/test-build-id/en/fallback/new.json"}
      ${"/base/_next/data/test-build-id/fr/fallback/new.json"} | ${"/_next/data/test-build-id/fr/fallback/new.json"}
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
      uri
      ${"/base/ssr/1"}
      ${"/base/en/ssr/1"}
      ${"/base/fr/ssr/1"}
      ${"/base/_next/data/test-build-id/ssr/1.json"}
    `("Routes SSR request $uri to pages/ssr/[id].js", async ({ uri }) => {
      await expect(
        handleDefault(
          mockEvent(uri),
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        )
      ).rejects.toThrow(TypeError);

      expect(getPage).toHaveBeenCalledWith("pages/ssr/[id].js");
    });
  });

  describe("Redirect", () => {
    it.each`
      uri                           | code   | destination
      ${"/base/ssg/"}               | ${308} | ${"/base/ssg"}
      ${"/base/favicon.ico/"}       | ${308} | ${"/base/favicon.ico"}
      ${"/base/redirect-simple"}    | ${307} | ${"/base/en/redirect-target"}
      ${"/base/redirect/test"}      | ${308} | ${"/base/en/redirect-target/test"}
      ${"/base/en/redirect-simple"} | ${307} | ${"/base/en/redirect-target"}
      ${"/base/en/redirect/test"}   | ${308} | ${"/base/en/redirect-target/test"}
      ${"/base/fr/redirect-simple"} | ${307} | ${"/base/fr/redirect-target"}
      ${"/base/fr/redirect/test"}   | ${308} | ${"/base/fr/redirect-target/test"}
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
