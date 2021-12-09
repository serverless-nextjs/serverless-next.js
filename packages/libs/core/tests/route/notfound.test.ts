import { notFoundPage } from "../../src/route/notfound";
import { PageManifest, RoutesManifest } from "../../src";

describe("notFoundPage()", () => {
  let htmlManifest: PageManifest;
  let ssgManifest: PageManifest;
  let routesManifest: RoutesManifest;
  let i18nRoutesManifest: RoutesManifest;

  beforeAll(() => {
    htmlManifest = {
      buildId: "test-build-id",
      pages: {
        dynamic: [],
        html: {
          dynamic: {},
          nonDynamic: {
            "/404": "pages/404.html",
            "/en/404": "pages/en/404.html",
            "/fr/404": "pages/fr/404.html"
          }
        },
        ssg: {
          dynamic: {},
          nonDynamic: {}
        },
        ssr: {
          dynamic: {},
          nonDynamic: {}
        }
      },
      publicFiles: {},
      trailingSlash: false
    };
    ssgManifest = {
      buildId: "test-build-id",
      pages: {
        dynamic: [],
        html: {
          dynamic: {},
          nonDynamic: {}
        },
        ssg: {
          dynamic: {},
          nonDynamic: {
            "/404": {
              initialRevalidateSeconds: false,
              srcRoute: null
            },
            "/en/404": {
              initialRevalidateSeconds: false,
              srcRoute: null
            },
            "/fr/404": {
              initialRevalidateSeconds: false,
              srcRoute: null
            }
          }
        },
        ssr: {
          dynamic: {},
          nonDynamic: {}
        }
      },
      publicFiles: {},
      trailingSlash: false
    };
    routesManifest = {
      basePath: "",
      headers: [],
      redirects: [],
      rewrites: []
    };
    i18nRoutesManifest = {
      basePath: "/base",
      headers: [],
      redirects: [],
      rewrites: [],
      i18n: {
        defaultLocale: "en",
        locales: ["en", "fr"],
        localeDetection: true
      }
    };
  });

  describe("Not found (html)", () => {
    it.each`
      uri       | file
      ${"/"}    | ${"pages/404.html"}
      ${"/foo"} | ${"pages/404.html"}
    `("Not found for $uri routes to file $file", async ({ uri, file }) => {
      const route = await notFoundPage(uri, htmlManifest, routesManifest);

      expect(route.isStatic).toBeTruthy();
      expect(route.file).toEqual(file);
    });
  });

  describe("Not found (ssg)", () => {
    it.each`
      uri       | file
      ${"/"}    | ${"pages/404.html"}
      ${"/foo"} | ${"pages/404.html"}
    `("Not found for $uri routes to file $file", async ({ uri, file }) => {
      const route = await notFoundPage(uri, ssgManifest, routesManifest);

      expect(route.isStatic).toBeTruthy();
      expect(route.file).toEqual(file);
    });
  });

  describe("Not found (html, basepath + locales)", () => {
    it.each`
      uri               | file
      ${"/base"}        | ${"pages/en/404.html"}
      ${"/base/foo"}    | ${"pages/en/404.html"}
      ${"/base/en"}     | ${"pages/en/404.html"}
      ${"/base/en/foo"} | ${"pages/en/404.html"}
      ${"/base/fr"}     | ${"pages/fr/404.html"}
      ${"/base/fr/foo"} | ${"pages/fr/404.html"}
    `("Not found for $uri routes to file $file", async ({ uri, file }) => {
      const route = await notFoundPage(uri, htmlManifest, i18nRoutesManifest);

      expect(route.isStatic).toBeTruthy();
      expect(route.file).toEqual(file);
    });
  });

  describe("Not found (ssg, basepath + locales)", () => {
    it.each`
      uri               | file
      ${"/base"}        | ${"pages/en/404.html"}
      ${"/base/foo"}    | ${"pages/en/404.html"}
      ${"/base/en"}     | ${"pages/en/404.html"}
      ${"/base/en/foo"} | ${"pages/en/404.html"}
      ${"/base/fr"}     | ${"pages/fr/404.html"}
      ${"/base/fr/foo"} | ${"pages/fr/404.html"}
    `("Not found for $uri routes to file $file", async ({ uri, file }) => {
      const route = await notFoundPage(uri, htmlManifest, i18nRoutesManifest);

      expect(route.isStatic).toBeTruthy();
      expect(route.file).toEqual(file);
    });
  });
});
