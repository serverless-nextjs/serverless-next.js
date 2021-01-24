import { RoutesManifest } from "../../src/types";
import { addDefaultLocaleToPath } from "../../src/routing/common-utils";

describe("CommonUtils Tests", () => {
  describe("addDefaultLocaleToPath()", () => {
    let routesManifest: RoutesManifest;

    beforeAll(() => {
      routesManifest = {
        basePath: "",
        rewrites: [
          { source: "/en/a", destination: "/en/b", regex: "^/en/a$" },
          {
            source: "/:nextInternalLocale(en|nl|fr)/a",
            destination: "/:nextInternalLocale/b",
            regex: "^(?:/(en|nl|fr))/a$"
          }
        ],
        redirects: [],
        headers: [],
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
});
