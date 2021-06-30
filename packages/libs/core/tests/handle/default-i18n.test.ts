import { PrerenderManifest } from "next/dist/build";
import {
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";
import { mockEvent } from "./utils";

describe("Default handler (i18n)", () => {
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
        "/en/500": {
          initialRevalidateSeconds: false,
          srcRoute: null,
          dataRoute: "unused"
        },
        "/fr/500": {
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
      basePath: "",
      headers: [],
      redirects: [
        {
          source: "/:nextInternalLocale(en|fr)/redirect-simple",
          destination: "/:nextInternalLocale/redirect-target",
          statusCode: 307
        },
        {
          source: "/:nextInternalLocale(en|fr)/redirect/:dynamic",
          destination: "/:nextInternalLocale/redirect-target/:dynamic",
          statusCode: 308
        }
      ],
      rewrites: [],
      i18n: {
        defaultLocale: "en",
        locales: ["en", "fr"],
        localeDetection: true
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
      uri                | file
      ${"/"}             | ${"pages/en.html"}
      ${"/ssg"}          | ${"pages/en/ssg.html"}
      ${"/not/found"}    | ${"pages/en/404.html"}
      ${"/en"}           | ${"pages/en.html"}
      ${"/en/ssg"}       | ${"pages/en/ssg.html"}
      ${"/en/not/found"} | ${"pages/en/404.html"}
      ${"/fr"}           | ${"pages/fr.html"}
      ${"/fr/ssg"}       | ${"pages/fr/ssg.html"}
      ${"/fr/not/found"} | ${"pages/fr/404.html"}
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
      uri                                        | file
      ${"/_next/data/test-build-id/ssg.json"}    | ${"/_next/data/test-build-id/en/ssg.json"}
      ${"/_next/data/test-build-id/en/ssg.json"} | ${"/_next/data/test-build-id/en/ssg.json"}
      ${"/_next/data/test-build-id/fr/ssg.json"} | ${"/_next/data/test-build-id/fr/ssg.json"}
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
      uri                                     | file
      ${"/ssr"}                               | ${"pages/en/500.html"}
      ${"/en/ssr"}                            | ${"pages/en/500.html"}
      ${"/fr/ssr"}                            | ${"pages/fr/500.html"}
      ${"/_next/data/test-build-id/ssr.json"} | ${"pages/en/500.html"}
    `("Routes SSR request $uri to pages/ssr.js", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith("pages/ssr.js");

      // mocked getPage throws an error in render, so error page returned
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });
  });

  describe("Dynamic", () => {
    it.each`
      uri                   | file
      ${"/foo"}             | ${"pages/en/[root].html"}
      ${"/html/bar"}        | ${"pages/en/html/[page].html"}
      ${"/fallback/new"}    | ${"pages/en/fallback/new.html"}
      ${"/en/foo"}          | ${"pages/en/[root].html"}
      ${"/en/html/bar"}     | ${"pages/en/html/[page].html"}
      ${"/en/fallback/new"} | ${"pages/en/fallback/new.html"}
      ${"/fr/foo"}          | ${"pages/fr/[root].html"}
      ${"/fr/html/bar"}     | ${"pages/fr/html/[page].html"}
      ${"/fr/fallback/new"} | ${"pages/fr/fallback/new.html"}
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
      uri                                                 | file
      ${"/_next/data/test-build-id/fallback/new.json"}    | ${"/_next/data/test-build-id/en/fallback/new.json"}
      ${"/_next/data/test-build-id/en/fallback/new.json"} | ${"/_next/data/test-build-id/en/fallback/new.json"}
      ${"/_next/data/test-build-id/fr/fallback/new.json"} | ${"/_next/data/test-build-id/fr/fallback/new.json"}
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
      uri                                       | file
      ${"/ssr/1"}                               | ${"pages/en/500.html"}
      ${"/en/ssr/1"}                            | ${"pages/en/500.html"}
      ${"/fr/ssr/1"}                            | ${"pages/fr/500.html"}
      ${"/_next/data/test-build-id/ssr/1.json"} | ${"pages/en/500.html"}
    `("Routes SSR request $uri to pages/ssr/[id].js", async ({ uri, file }) => {
      const route = await handleDefault(
        mockEvent(uri),
        manifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(getPage).toHaveBeenCalledWith("pages/ssr/[id].js");

      // mocked getPage throws an error in render, so error page returned
      expect(route).toBeTruthy();
      if (route) {
        expect(route.isStatic).toBeTruthy();
        expect(route.file).toEqual(file);
      }
    });
  });

  describe("Redirect", () => {
    it.each`
      uri                      | code   | destination
      ${"/ssg/"}               | ${308} | ${"/ssg"}
      ${"/favicon.ico/"}       | ${308} | ${"/favicon.ico"}
      ${"/redirect-simple"}    | ${307} | ${"/en/redirect-target"}
      ${"/redirect/test"}      | ${308} | ${"/en/redirect-target/test"}
      ${"/en/redirect-simple"} | ${307} | ${"/en/redirect-target"}
      ${"/en/redirect/test"}   | ${308} | ${"/en/redirect-target/test"}
      ${"/fr/redirect-simple"} | ${307} | ${"/fr/redirect-target"}
      ${"/fr/redirect/test"}   | ${308} | ${"/fr/redirect-target/test"}
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
      uri       | lang    | destination
      ${"/"}    | ${"en"} | ${null}
      ${"/"}    | ${"fr"} | ${"/fr"}
      ${"/en"}  | ${"en"} | ${null}
      ${"/en"}  | ${"fr"} | ${null}
      ${"/fr"}  | ${"en"} | ${null}
      ${"/fr"}  | ${"fr"} | ${null}
      ${"/ssg"} | ${"en"} | ${null}
      ${"/ssg"} | ${"fr"} | ${null}
    `(
      "Redirects accept-lang $lang from $uri to $destination",
      async ({ lang, destination, uri }) => {
        const event = mockEvent(uri, {
          "Accept-Language": lang
        });
        const route = await handleDefault(
          event,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        if (destination) {
          expect(route).toBeFalsy();
          expect(event.res.statusCode).toEqual(307);
          expect(event.res.setHeader).toHaveBeenCalledWith(
            "Location",
            destination
          );
          expect(event.res.end).toHaveBeenCalled();
        } else {
          expect(route).toBeTruthy();
        }
      }
    );

    it.each`
      uri       | lang    | destination
      ${"/"}    | ${"en"} | ${null}
      ${"/"}    | ${"fr"} | ${"/fr"}
      ${"/en"}  | ${"en"} | ${null}
      ${"/en"}  | ${"fr"} | ${null}
      ${"/fr"}  | ${"en"} | ${null}
      ${"/fr"}  | ${"fr"} | ${null}
      ${"/ssg"} | ${"en"} | ${null}
      ${"/ssg"} | ${"fr"} | ${null}
    `(
      "Redirects NEXT_LOCALE $lang from $uri to $destination",
      async ({ lang, destination, uri }) => {
        const event = mockEvent(uri, {
          Cookie: `NEXT_LOCALE=${lang}`
        });
        const route = await handleDefault(
          event,
          manifest,
          prerenderManifest,
          routesManifest,
          getPage
        );

        if (destination) {
          expect(route).toBeFalsy();
          expect(event.res.statusCode).toEqual(307);
          expect(event.res.setHeader).toHaveBeenCalledWith(
            "Location",
            destination
          );
          expect(event.res.end).toHaveBeenCalled();
        } else {
          expect(route).toBeTruthy();
        }
      }
    );
  });
});
