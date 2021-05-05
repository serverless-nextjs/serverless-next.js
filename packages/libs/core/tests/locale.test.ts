import { Manifest, RoutesManifest } from "../src/types";
import { addDefaultLocaleToPath, getAcceptLanguageLocale } from "../src/locale";

describe("Locale Utils Tests", () => {
  describe("addDefaultLocaleToPath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        redirects: [],
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

  describe("getAcceptLanguageLocale()", () => {
    let manifest: Manifest;
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      manifest = {
        trailingSlash: true
      };
      routesManifest = {
        basePath: "",
        redirects: [],
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
      ({ acceptLang, expectedPath }) => {
        const newPath = getAcceptLanguageLocale(
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
    `("returns nothing for $acceptLang", ({ acceptLang }) => {
      const newPath = getAcceptLanguageLocale(
        acceptLang,
        manifest,
        routesManifest
      );

      expect(!newPath).toBe(true);
    });
  });
});
