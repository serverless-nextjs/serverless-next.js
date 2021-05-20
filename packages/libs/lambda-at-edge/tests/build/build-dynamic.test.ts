import { join } from "path";
import fse from "fs-extra";
import execa from "execa";
import Builder, { ASSETS_DIR } from "../../src/build";
import {
  DEFAULT_LAMBDA_CODE_DIR,
  API_LAMBDA_CODE_DIR,
  IMAGE_LAMBDA_CODE_DIR
} from "../../src/build";
import { cleanupDir, removeNewLineChars } from "../test-utils";
import { OriginRequestDefaultHandlerManifest } from "../../src/types";

jest.mock("execa");

describe("Builder Tests (dynamic)", () => {
  let fseRemoveSpy: jest.SpyInstance;
  let fseEmptyDirSpy: jest.SpyInstance;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;

  const fixturePath = join(__dirname, "./dynamic-app-fixture");
  const outputDir = join(fixturePath, ".test_sls_next_output");

  beforeEach(async () => {
    const mockExeca = execa as jest.Mock;
    mockExeca.mockResolvedValueOnce();

    fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
      return;
    });
    fseEmptyDirSpy = jest.spyOn(fse, "emptyDir");

    const builder = new Builder(fixturePath, outputDir);
    await builder.build();

    defaultBuildManifest = await fse.readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterEach(() => {
    fseEmptyDirSpy.mockRestore();
    fseRemoveSpy.mockRestore();
    return cleanupDir(outputDir);
  });

  describe("Cleanup", () => {
    it(".next directory is emptied except for cache/ folder", () => {
      expect(fseRemoveSpy).toBeCalledWith(
        join(fixturePath, ".next/serverless")
      );
      expect(fseRemoveSpy).toBeCalledWith(
        join(fixturePath, ".next/prerender-manifest.json")
      );
      expect(fseRemoveSpy).not.toBeCalledWith(join(fixturePath, ".next/cache"));
    });

    it("output directory is cleanup before building", () => {
      expect(fseEmptyDirSpy).toBeCalledWith(
        expect.stringContaining(join(".test_sls_next_output", "default-lambda"))
      );
      expect(fseEmptyDirSpy).toBeCalledWith(
        expect.stringContaining(join(".test_sls_next_output", "api-lambda"))
      );
      expect(fseEmptyDirSpy).toBeCalledWith(
        expect.stringContaining(join(".test_sls_next_output", "assets"))
      );
    });
  });

  describe("Default Handler Manifest", () => {
    it("adds full manifest", () => {
      const {
        buildId,
        publicFiles,
        pages: { dynamic, ssr, ssg, html },
        trailingSlash
      } = defaultBuildManifest;

      expect(removeNewLineChars(buildId)).toEqual("test-build-id");

      expect(dynamic).toEqual([
        {
          route: "/catchall/[...slug]",
          regex:
            "^\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        {
          route: "/en/catchall/[...slug]",
          regex:
            "^\\/en\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        {
          route: "/en/fallback/[slug]",
          regex: "^\\/en\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/en/fallback-blocking/[slug]",
          regex: "^\\/en\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/en/no-fallback/[slug]",
          regex: "^\\/en\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/en/optional-catchall/[[...slug]]",
          regex:
            "^\\/en\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        {
          route: "/fallback/[slug]",
          regex: "^\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/fallback-blocking/[slug]",
          regex: "^\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/nl/catchall/[...slug]",
          regex:
            "^\\/nl\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        {
          route: "/nl/fallback/[slug]",
          regex: "^\\/nl\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/nl/fallback-blocking/[slug]",
          regex: "^\\/nl\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/nl/no-fallback/[slug]",
          regex: "^\\/nl\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/nl/optional-catchall/[[...slug]]",
          regex:
            "^\\/nl\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        {
          route: "/no-fallback/[slug]",
          regex: "^\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        {
          route: "/optional-catchall/[[...slug]]",
          regex:
            "^\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        }
      ]);

      // Should non-localized variants be removed?
      expect(ssr).toEqual({
        dynamic: {
          "/catchall/[...slug]": "pages/catchall/[...slug].js",
          "/en/catchall/[...slug]": "pages/catchall/[...slug].js",
          "/en/fallback-blocking/[slug]": "pages/fallback-blocking/[slug].js",
          "/en/fallback/[slug]": "pages/fallback/[slug].js",
          "/en/no-fallback/[slug]": "pages/no-fallback/[slug].js",
          "/en/optional-catchall/[[...slug]]":
            "pages/optional-catchall/[[...slug]].js",
          "/fallback-blocking/[slug]": "pages/fallback-blocking/[slug].js",
          "/fallback/[slug]": "pages/fallback/[slug].js",
          "/nl/catchall/[...slug]": "pages/catchall/[...slug].js",
          "/nl/fallback-blocking/[slug]": "pages/fallback-blocking/[slug].js",
          "/nl/fallback/[slug]": "pages/fallback/[slug].js",
          "/nl/no-fallback/[slug]": "pages/no-fallback/[slug].js",
          "/nl/optional-catchall/[[...slug]]":
            "pages/optional-catchall/[[...slug]].js",
          "/no-fallback/[slug]": "pages/no-fallback/[slug].js",
          "/optional-catchall/[[...slug]]":
            "pages/optional-catchall/[[...slug]].js"
        },
        nonDynamic: {
          "/": "pages/index.js",
          "/_error": "pages/_error.js",
          "/en": "pages/index.js",
          "/en/_error": "pages/_error.js",
          "/en/optional-catchall": "pages/optional-catchall/[[...slug]].js",
          "/en/ssg": "pages/ssg.js",
          "/en/ssr": "pages/ssr.js",
          "/nl": "pages/index.js",
          "/nl/_error": "pages/_error.js",
          "/nl/optional-catchall": "pages/optional-catchall/[[...slug]].js",
          "/nl/ssg": "pages/ssg.js",
          "/nl/ssr": "pages/ssr.js",
          "/optional-catchall": "pages/optional-catchall/[[...slug]].js",
          "/ssg": "pages/ssg.js",
          "/ssr": "pages/ssr.js"
        }
      });

      expect(html).toEqual({
        dynamic: {},
        nonDynamic: {
          "/en/404": "pages/en/404.html",
          "/en/500": "pages/en/500.html",
          "/en/static": "pages/en/static.html",
          "/nl/404": "pages/nl/404.html",
          "/nl/500": "pages/nl/500.html",
          "/nl/static": "pages/nl/static.html"
        }
      });

      // Should non-localized variants be removed?
      expect(ssg).toEqual({
        dynamic: {
          "/en/fallback-blocking/[slug]": {
            fallback: null
          },
          "/en/fallback/[slug]": {
            fallback: "/en/fallback/[slug].html"
          },
          "/en/no-fallback/[slug]": {
            fallback: false
          },
          "/fallback-blocking/[slug]": {
            fallback: null
          },
          "/fallback/[slug]": {
            fallback: "/fallback/[slug].html"
          },
          "/nl/fallback-blocking/[slug]": {
            fallback: null
          },
          "/nl/fallback/[slug]": {
            fallback: "/nl/fallback/[slug].html"
          },
          "/nl/no-fallback/[slug]": {
            fallback: false
          },
          "/no-fallback/[slug]": {
            fallback: false
          }
        },
        nonDynamic: {
          "/en": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/en": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/fallback-blocking/a": {
            initialRevalidateSeconds: false,
            srcRoute: "/fallback-blocking/[slug]"
          },
          "/en/fallback/a": {
            initialRevalidateSeconds: false,
            srcRoute: "/fallback/[slug]"
          },
          "/en/nl": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/nl/ssg": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/no-fallback/a": {
            initialRevalidateSeconds: false,
            srcRoute: "/no-fallback/[slug]"
          },
          "/en/ssg": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/en": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/nl": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/nl/ssg": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/ssg": {
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/ssg": {
            initialRevalidateSeconds: false,
            srcRoute: null
          }
        }
      });

      expect(publicFiles).toEqual({
        "/public-file.txt": "public-file.txt"
      });

      expect(trailingSlash).toBe(false);
    });
  });

  describe("API Handler", () => {
    it("has empty API handler directory", async () => {
      expect.assertions(1);

      const apiDir = await fse.readdir(
        join(outputDir, `${API_LAMBDA_CODE_DIR}`)
      );

      expect(apiDir).toEqual([]);
    });
  });

  describe("Images Handler", () => {
    it("has empty images handler directory", async () => {
      expect.assertions(1);

      const imageDir = await fse.readdir(
        join(outputDir, `${IMAGE_LAMBDA_CODE_DIR}`)
      );

      expect(imageDir).toEqual([]);
    });
  });

  describe("Default Handler", () => {
    it("copies build files", async () => {
      const files = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}`)
      );
      const pages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages`)
      );
      const enPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/en`)
      );
      const enFallbackPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/en/fallback`)
      );
      const enFallbackBlockingPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/en/fallback-blocking`)
      );
      const enNoFallbackPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/en/no-fallback`)
      );
      const catchallPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/catchall`)
      );
      const optionalCatchallPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/optional-catchall`)
      );
      const fallbackPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/fallback`)
      );
      const fallbackBlockingPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/fallback-blocking`)
      );
      const nofallbackPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/no-fallback`)
      );
      const apiDirExists = await fse.pathExists(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/api`)
      );

      expect(files).toEqual(
        expect.arrayContaining([
          "index.js", // there are more chunks but it should at least contain the entry point
          "manifest.json",
          "pages",
          "prerender-manifest.json",
          "routes-manifest.json"
        ])
      );

      // api pages should not be included in the default lambda
      expect(apiDirExists).toEqual(false);

      // Since en and nl are ultimately empty, those don't need to be here
      expect(pages).toEqual([
        "_error.js",
        "catchall",
        "en",
        "fallback",
        "fallback-blocking",
        "index.js",
        "nl",
        "no-fallback",
        "optional-catchall",
        "ssg.js",
        "ssr.js"
      ]);

      // These could be removed
      expect(enPages).toEqual(["fallback", "fallback-blocking", "no-fallback"]);
      expect(enFallbackPages).toEqual([]);
      expect(enFallbackBlockingPages).toEqual([]);
      expect(enNoFallbackPages).toEqual([]);

      expect(catchallPages).toEqual(["[...slug].js"]);
      expect(optionalCatchallPages).toEqual(["[[...slug]].js"]);

      expect(fallbackPages).toEqual(["[slug].js"]);
      expect(fallbackBlockingPages).toEqual(["[slug].js"]);
      expect(nofallbackPages).toEqual(["[slug].js"]);
    });
  });

  describe("Assets", () => {
    it("copies locale-specific asset files", async () => {
      //expect.assertions(9);
      // Root
      const preDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data`)
      );
      expect(preDataFiles).toEqual(["test-build-id"]);
      const nextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id`)
      );
      expect(nextDataFiles).toEqual(["en", "en.json", "nl", "nl.json"]);

      // English
      const enNextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/en`)
      );
      expect(enNextDataFiles).toEqual([
        "fallback",
        "fallback-blocking",
        "no-fallback",
        "ssg.json"
      ]);

      const enPageFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/en`)
      );
      expect(enPageFiles).toEqual([
        "404.html",
        "500.html",
        "fallback",
        "fallback-blocking",
        "no-fallback",
        "ssg.html",
        "static.html"
      ]);

      const enFallbackFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/en/fallback`)
      );
      expect(enFallbackFiles).toEqual(["[slug].html", "a.html"]);

      const enFallbackBlockingFiles = await fse.readdir(
        join(
          outputDir,
          `${ASSETS_DIR}/static-pages/test-build-id/en/fallback-blocking`
        )
      );
      expect(enFallbackBlockingFiles).toEqual(["a.html"]);

      const enNoFallbackFiles = await fse.readdir(
        join(
          outputDir,
          `${ASSETS_DIR}/static-pages/test-build-id/en/no-fallback`
        )
      );
      expect(enNoFallbackFiles).toEqual(["a.html"]);

      // Dutch
      const nlNextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/nl`)
      );
      expect(nlNextDataFiles).toEqual(["ssg.json"]);

      const nlPageFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/nl`)
      );
      expect(nlPageFiles).toEqual([
        "404.html",
        "500.html",
        "fallback",
        "ssg.html",
        "static.html"
      ]);

      const nlFallbackFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/nl/fallback`)
      );
      expect(nlFallbackFiles).toEqual(["[slug].html"]);
    });
  });
});
