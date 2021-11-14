import { Manifest, RoutesManifest } from "../../src";
import {
  addDefaultLocaleToPath,
  dropLocaleFromPath,
  getAcceptLanguageLocale,
  findDomainLocale,
  getLocaleDomainRedirect
} from "../../src/route/locale";

describe("Locale Utils Tests", () => {
  describe("addDefaultLocaleToPath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        redirects: [],
        rewrites: [],
        i18n: {
          locales: ["en", "fr", "nl", "en-GB"],
          defaultLocale: "en",
          localeDetection: true
        }
      };
    });

    it.each`
      path          | forceLocale | expectedPath
      ${"/a"}       | ${null}     | ${"/en/a"}
      ${"/en/a"}    | ${null}     | ${"/en/a"}
      ${"/fr/a"}    | ${null}     | ${"/fr/a"}
      ${"/en-GB/a"} | ${null}     | ${"/en-GB/a"}
      ${"/en-gb/a"} | ${null}     | ${"/en-GB/a"}
      ${"/nl/a"}    | ${"en"}     | ${"/en/a"}
    `(
      "changes path $path to $expectedPath",
      ({ path, forceLocale, expectedPath }) => {
        const newPath = addDefaultLocaleToPath(
          path,
          routesManifest,
          forceLocale
        );

        expect(newPath).toBe(expectedPath);
      }
    );
  });

  describe("findDomainLocale()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        redirects: [],
        rewrites: [],
        i18n: {
          locales: ["en", "fr", "nl"],
          defaultLocale: "en",
          domains: [
            {
              domain: "next-serverless.fr",
              defaultLocale: "fr"
            },
            {
              domain: "next-serverless.com",
              defaultLocale: "en"
            }
          ]
        }
      };
    });

    it.each`
      xForwardedHost           | expectedResult
      ${"google.com"}          | ${null}
      ${"next-serverless.fr"}  | ${"fr"}
      ${"next-serverless.com"} | ${"en"}
    `(
      "$xForwardedHost is resolved to $expectedResult",
      ({ xForwardedHost, expectedResult }) => {
        const req = {
          headers: {
            "x-forwarded-host": xForwardedHost
          },
          uri: "/test"
        };
        const newPath = findDomainLocale(req, routesManifest);

        expect(newPath).toBe(expectedResult);
      }
    );

    it.each`
      host                     | expectedResult
      ${"google.com"}          | ${null}
      ${"next-serverless.fr"}  | ${"fr"}
      ${"next-serverless.com"} | ${"en"}
    `("$host is resolved to $expectedResult", ({ host, expectedResult }) => {
      const req = {
        headers: {
          host: [{ key: "Host", value: host }]
        },
        uri: "/test"
      };
      const newPath = findDomainLocale(req, routesManifest);

      expect(newPath).toBe(expectedResult);
    });
  });

  describe("getLocaleDomainRedirect()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        headers: [],
        redirects: [],
        rewrites: [],
        i18n: {
          locales: ["en", "fr", "nl"],
          defaultLocale: "en",
          domains: [
            {
              domain: "next-serverless.fr",
              defaultLocale: "fr"
            },
            {
              domain: "next-serverless.com",
              defaultLocale: "en",
              locales: ["es", "en-GB"]
            },
            {
              domain: "next-serverless.nl",
              defaultLocale: "nl"
            }
          ]
        }
      };
    });

    it.each`
      host                     | acceptLang              | cookie              | expectedRedirect
      ${"next-serverless.com"} | ${"en"}                 | ${undefined}        | ${undefined}
      ${"next-serverless.com"} | ${"fr"}                 | ${undefined}        | ${"next-serverless.fr/test"}
      ${"next-serverless.com"} | ${"fr;q=0.7, nl;q=0.9"} | ${undefined}        | ${"next-serverless.nl/test"}
      ${"next-serverless.fr"}  | ${"es"}                 | ${undefined}        | ${"next-serverless.com/test"}
      ${"next-serverless.fr"}  | ${"en-GB"}              | ${undefined}        | ${"next-serverless.com/test"}
      ${"next-serverless.com"} | ${"en"}                 | ${"NEXT_LOCALE=fr"} | ${"next-serverless.fr/test"}
    `(
      "host: $host with accept-language: $acceptLang and cookie: $cookie redirects to $expectedRedirect",
      async ({ host, acceptLang, cookie, expectedRedirect }) => {
        const req = {
          headers: {
            host: [{ key: "Host", value: host }],
            "accept-language": [{ key: "Accept-Language", value: acceptLang }],
            cookie: [{ key: "Cookie", value: cookie }]
          },
          uri: "/test"
        };

        expect(await getLocaleDomainRedirect(req, routesManifest)).toBe(
          expectedRedirect
        );
      }
    );
  });

  describe("dropLocaleFromPath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "/base",
        headers: [],
        redirects: [],
        rewrites: [],
        i18n: {
          locales: ["en", "fr", "en-GB"],
          defaultLocale: "en",
          localeDetection: true
        }
      };
    });

    it.each`
      path             | expectedPath
      ${"/en"}         | ${"/"}
      ${"/en/test"}    | ${"/test"}
      ${"/en-GB/test"} | ${"/test"}
      ${"/fr/api/foo"} | ${"/api/foo"}
    `("changes path $path to $expectedPath", ({ path, expectedPath }) => {
      const newPath = dropLocaleFromPath(path, routesManifest);

      expect(newPath).toBe(expectedPath);
    });

    it.each`
      path
      ${"/base/en"}         | ${"/base"}
      ${"/base/en/test"}    | ${"/base/test"}
      ${"/base/en-GB/test"} | ${"/base/test"}
      ${"/base/fr/api/foo"} | ${"/base/api/foo"}
    `("keeps path $path unchanged", ({ path }) => {
      const newPath = dropLocaleFromPath(path, routesManifest);

      expect(newPath).toBe(path);
    });
  });

  describe("getAcceptLanguageLocale()", () => {
    let manifest: Manifest;
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      manifest = {
        trailingSlash: true
      };
      routesManifest = {
        basePath: "",
        headers: [],
        redirects: [],
        rewrites: [],
        i18n: {
          locales: ["en", "en-GB", "fr", "nl"],
          defaultLocale: "en",
          localeDetection: true
        }
      };
    });

    it.each`
      acceptLang              | expectedPath
      ${"fr"}                 | ${"/fr/"}
      ${"nl"}                 | ${"/nl/"}
      ${"de, fr"}             | ${"/fr/"}
      ${"fr;q=0.7, nl;q=0.9"} | ${"/nl/"}
      ${"en-GB"}              | ${"/en-GB/"}
      ${"en-gb"}              | ${"/en-GB/"}
    `(
      "returns $expectedPath for $acceptLang",
      async ({ acceptLang, expectedPath }) => {
        const newPath = await getAcceptLanguageLocale(
          acceptLang,
          manifest,
          routesManifest
        );

        expect(newPath).toBe(expectedPath);
      }
    );

    it.each`
      acceptLang
      ${"en"}
      ${"nl;q=0.7, en;q=0.9"}
    `("returns nothing for $acceptLang", async ({ acceptLang }) => {
      const newPath = await getAcceptLanguageLocale(
        acceptLang,
        manifest,
        routesManifest
      );

      expect(!newPath).toBe(true);
    });
  });
});
