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
        pages: {
          ssr: { dynamic, catchAll, nonDynamic },
          ssg,
          html
        },
        trailingSlash
      } = defaultBuildManifest;

      expect(removeNewLineChars(buildId)).toEqual("test-build-id");

      // These could be removed from build?
      expect(dynamic).toEqual({
        "/en/fallback-blocking/:slug": {
          file: "pages/fallback-blocking/[slug].js",
          regex: "^\\/en\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/en/fallback/:slug": {
          file: "pages/fallback/[slug].js",
          regex: "^\\/en\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/en/no-fallback/:slug": {
          file: "pages/no-fallback/[slug].js",
          regex: "^\\/en\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/fallback-blocking/:slug": {
          file: "pages/fallback-blocking/[slug].js",
          regex: "^\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/fallback/:slug": {
          file: "pages/fallback/[slug].js",
          regex: "^\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/nl/fallback-blocking/:slug": {
          file: "pages/fallback-blocking/[slug].js",
          regex: "^\\/nl\\/fallback-blocking(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/nl/fallback/:slug": {
          file: "pages/fallback/[slug].js",
          regex: "^\\/nl\\/fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/nl/no-fallback/:slug": {
          file: "pages/no-fallback/[slug].js",
          regex: "^\\/nl\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/no-fallback/:slug": {
          file: "pages/no-fallback/[slug].js",
          regex: "^\\/no-fallback(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        }
      });

      // Should non-localized variants be removed?
      expect(catchAll).toEqual({
        "/catchall/:slug*": {
          file: "pages/catchall/[...slug].js",
          regex:
            "^\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/en/catchall/:slug*": {
          file: "pages/catchall/[...slug].js",
          regex:
            "^\\/en\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/en/optional-catchall/:slug*": {
          file: "pages/optional-catchall/[[...slug]].js",
          regex:
            "^\\/en\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/nl/catchall/:slug*": {
          file: "pages/catchall/[...slug].js",
          regex:
            "^\\/nl\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/nl/optional-catchall/:slug*": {
          file: "pages/optional-catchall/[[...slug]].js",
          regex:
            "^\\/nl\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/optional-catchall/:slug*": {
          file: "pages/optional-catchall/[[...slug]].js",
          regex:
            "^\\/optional-catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        }
      });

      // Should non-localized variants be removed?
      expect(nonDynamic).toEqual({
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
            dataRoute:
              "/_next/data/test-build-id/en/fallback-blocking/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/en/fallback\\-blocking/([^/]+?)\\.json$",
            fallback: null,
            routeRegex: "^/en/fallback\\-blocking/([^/]+?)(?:/)?$"
          },
          "/en/fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/en/fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/en/fallback/([^/]+?)\\.json$",
            fallback: "/en/fallback/[slug].html",
            routeRegex: "^/en/fallback/([^/]+?)(?:/)?$"
          },
          "/en/no-fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/en/no-fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/en/no\\-fallback/([^/]+?)\\.json$",
            fallback: false,
            routeRegex: "^/en/no\\-fallback/([^/]+?)(?:/)?$"
          },
          "/fallback-blocking/[slug]": {
            dataRoute:
              "/_next/data/test-build-id/fallback-blocking/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/fallback\\-blocking/([^/]+?)\\.json$",
            fallback: null,
            routeRegex: "^/fallback\\-blocking/([^/]+?)(?:/)?$"
          },
          "/fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/fallback/([^/]+?)\\.json$",
            fallback: "/fallback/[slug].html",
            routeRegex: "^/fallback/([^/]+?)(?:/)?$"
          },
          "/nl/fallback-blocking/[slug]": {
            dataRoute:
              "/_next/data/test-build-id/nl/fallback-blocking/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/nl/fallback\\-blocking/([^/]+?)\\.json$",
            fallback: null,
            routeRegex: "^/nl/fallback\\-blocking/([^/]+?)(?:/)?$"
          },
          "/nl/fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/nl/fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/nl/fallback/([^/]+?)\\.json$",
            fallback: "/nl/fallback/[slug].html",
            routeRegex: "^/nl/fallback/([^/]+?)(?:/)?$"
          },
          "/nl/no-fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/nl/no-fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/nl/no\\-fallback/([^/]+?)\\.json$",
            fallback: false,
            routeRegex: "^/nl/no\\-fallback/([^/]+?)(?:/)?$"
          },
          "/no-fallback/[slug]": {
            dataRoute: "/_next/data/test-build-id/no-fallback/[slug].json",
            dataRouteRegex:
              "^/_next/data/test-build-id/no\\-fallback/([^/]+?)\\.json$",
            fallback: false,
            routeRegex: "^/no\\-fallback/([^/]+?)(?:/)?$"
          }
        },
        nonDynamic: {
          "/en": {
            dataRoute: "/_next/data/test-build-id/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/en": {
            dataRoute: "/_next/data/test-build-id/en/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/fallback-blocking/a": {
            dataRoute: "/_next/data/test-build-id/en/fallback-blocking/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/en/fallback-blocking/[slug]"
          },
          "/en/fallback/a": {
            dataRoute: "/_next/data/test-build-id/en/fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/en/fallback/[slug]"
          },
          "/en/nl": {
            dataRoute: "/_next/data/test-build-id/en/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/nl/ssg": {
            dataRoute: "/_next/data/test-build-id/en/ssg.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/no-fallback/a": {
            dataRoute: "/_next/data/test-build-id/en/no-fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/en/no-fallback/[slug]"
          },
          "/en/ssg": {
            dataRoute: "/_next/data/test-build-id/en/ssg.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/fallback-blocking/a": {
            dataRoute: "/_next/data/test-build-id/fallback-blocking/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/fallback-blocking/[slug]"
          },
          "/fallback/a": {
            dataRoute: "/_next/data/test-build-id/fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/fallback/[slug]"
          },
          "/nl": {
            dataRoute: "/_next/data/test-build-id/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/en": {
            dataRoute: "/_next/data/test-build-id/nl/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/fallback-blocking/a": {
            dataRoute: "/_next/data/test-build-id/nl/fallback-blocking/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/nl/fallback-blocking/[slug]"
          },
          "/nl/fallback/a": {
            dataRoute: "/_next/data/test-build-id/nl/fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/nl/fallback/[slug]"
          },
          "/nl/nl": {
            dataRoute: "/_next/data/test-build-id/nl/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/nl/ssg": {
            dataRoute: "/_next/data/test-build-id/nl/ssg.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/no-fallback/a": {
            dataRoute: "/_next/data/test-build-id/nl/no-fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/nl/no-fallback/[slug]"
          },
          "/nl/ssg": {
            dataRoute: "/_next/data/test-build-id/nl/ssg.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/no-fallback/a": {
            dataRoute: "/_next/data/test-build-id/no-fallback/a.json",
            initialRevalidateSeconds: false,
            srcRoute: "/no-fallback/[slug]"
          },
          "/ssg": {
            dataRoute: "/_next/data/test-build-id/ssg.json",
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
