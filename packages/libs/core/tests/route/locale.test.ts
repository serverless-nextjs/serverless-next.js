import { Headers, Manifest, RoutesManifest } from "../../src";
import {
  addDefaultLocaleToPath,
  dropLocaleFromPath,
  getAcceptLanguageLocale,
  findDomainLocale,
  getLocaleDomainRedirect
} from "../../src/route/locale";
import { IncomingMessage } from "http";

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
          locales: ["en", "fr", "nl"],
          defaultLocale: "en"
        }
      };
    });

    it.each`
      path       | forceLocale | expectedPath
      ${"/a"}    | ${null}     | ${"/en/a"}
      ${"/en/a"} | ${null}     | ${"/en/a"}
      ${"/fr/a"} | ${null}     | ${"/fr/a"}
      ${"/nl/a"} | ${"en"}     | ${"/en/a"}
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
      host                     | expectedResult
      ${"google.com"}          | ${null}
      ${"next-serverless.fr"}  | ${"fr"}
      ${"next-serverless.com"} | ${"en"}
    `("$host is resolved to $expectedResult", ({ host, expectedResult }) => {
      const req = {
        headers: {
          host
        }
      } as unknown as IncomingMessage;
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
      host                     | acceptLang              | expectedRedirect
      ${"next-serverless.com"} | ${"en"}                 | ${undefined}
      ${"next-serverless.com"} | ${"fr"}                 | ${"next-serverless.fr/test"}
      ${"next-serverless.com"} | ${"fr;q=0.7, nl;q=0.9"} | ${"next-serverless.nl/test"}
      ${"next-serverless.fr"}  | ${"es"}                 | ${"next-serverless.com/test"}
      ${"next-serverless.fr"}  | ${"en-GB"}              | ${"next-serverless.com/test"}
    `(
      "host: $host with accept-language: $acceptLang redirects to $expectedRedirect",
      async ({ host, acceptLang, expectedRedirect }) => {
        const req = {
          headers: {
            host: [{ key: "Host", value: host }],
            "accept-language": [{ key: "Accept-Language", value: acceptLang }]
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
          locales: ["en", "fr"],
          defaultLocale: "en"
        }
      };
    });

    it.each`
      path             | expectedPath
      ${"/en"}         | ${"/"}
      ${"/en/test"}    | ${"/test"}
      ${"/fr/api/foo"} | ${"/api/foo"}
    `("changes path $path to $expectedPath", ({ path, expectedPath }) => {
      const newPath = dropLocaleFromPath(path, routesManifest);

      expect(newPath).toBe(expectedPath);
    });

    it.each`
      path
      ${"/base/en"}         | ${"/base"}
      ${"/base/en/test"}    | ${"/base/test"}
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
          locales: ["en", "fr", "nl"],
          defaultLocale: "en"
        }
      };
    });

    it.each`
      acceptLang              | expectedPath
      ${"fr"}                 | ${"/fr/"}
      ${"nl"}                 | ${"/nl/"}
      ${"de, fr"}             | ${"/fr/"}
      ${"fr;q=0.7, nl;q=0.9"} | ${"/nl/"}
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
