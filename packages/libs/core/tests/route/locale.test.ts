import { Manifest, RoutesManifest } from "../../src";
import {
  addDefaultLocaleToPath,
  dropLocaleFromPath,
  getAcceptLanguageLocale
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
          locales: ["en", "fr", "nl"],
          defaultLocale: "en"
        }
      };
    });

    it.each`
      path       | expectedPath
      ${"/a"}    | ${"/en/a"}
      ${"/en/a"} | ${"/en/a"}
      ${"/fr/a"} | ${"/fr/a"}
    `("changes path $path to $expectedPath", ({ path, expectedPath }) => {
      const newPath = addDefaultLocaleToPath(path, routesManifest);

      expect(newPath).toBe(expectedPath);
    });
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
