import { join } from "path";
import fse from "fs-extra";
import execa from "execa";
import Builder, { ASSETS_DIR } from "../../src/build";
import { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from "../../src/build";
import { cleanupDir, removeNewLineChars } from "../test-utils";
import { OriginRequestDefaultHandlerManifest } from "../../src/types";

jest.mock("execa");

describe("Builder Tests (with locales)", () => {
  let fseRemoveSpy: jest.SpyInstance;
  let fseEmptyDirSpy: jest.SpyInstance;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;

  const fixturePath = join(__dirname, "./simple-app-fixture-with-locales");
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
          ssr: { dynamic, nonDynamic },
          ssg,
          html
        },
        trailingSlash
      } = defaultBuildManifest;

      expect(removeNewLineChars(buildId)).toEqual("test-build-id");
      expect(dynamic).toEqual({
        "/:root": {
          file: "pages/[root].js",
          regex: expect.any(String)
        },
        "/customers/:customer": {
          file: "pages/customers/[customer].js",
          regex: expect.any(String)
        },
        "/customers/:customer/:post": {
          file: "pages/customers/[customer]/[post].js",
          regex: expect.any(String)
        },
        "/customers/:customer/profile": {
          file: "pages/customers/[customer]/profile.js",
          regex: expect.any(String)
        },
        "/customers/:catchAll*": {
          file: "pages/customers/[...catchAll].js",
          regex: expect.any(String)
        },
        "/en/:root": {
          file: "pages/[root].js",
          regex: "^\\/en(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/en/customers/:catchAll*": {
          file: "pages/customers/[...catchAll].js",
          regex:
            "^\\/en\\/customers(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$"
        },
        "/en/customers/:customer": {
          file: "pages/customers/[customer].js",
          regex: "^\\/en\\/customers(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/en/customers/:customer/:post": {
          file: "pages/customers/[customer]/[post].js",
          regex:
            "^\\/en\\/customers(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$"
        },
        "/en/customers/:customer/profile": {
          file: "pages/customers/[customer]/profile.js",
          regex: "^\\/en\\/customers(?:\\/([^\\/#\\?]+?))\\/profile[\\/#\\?]?$"
        },
        "/nl/:root": {
          file: "pages/[root].js",
          regex: expect.any(String)
        },
        "/nl/customers/:catchAll*": {
          file: "pages/customers/[...catchAll].js",
          regex: expect.any(String)
        },
        "/nl/customers/:customer": {
          file: "pages/customers/[customer].js",
          regex: expect.any(String)
        },
        "/nl/customers/:customer/:post": {
          file: "pages/customers/[customer]/[post].js",
          regex: expect.any(String)
        },
        "/nl/customers/:customer/profile": {
          file: "pages/customers/[customer]/profile.js",
          regex: expect.any(String)
        }
      });

      expect(nonDynamic).toEqual({
        "/customers/new": "pages/customers/new.js",
        "/": "pages/index.js",
        "/_app": "pages/_app.js",
        "/_document": "pages/_document.js",
        "/en": "pages/index.js",
        "/en/_app": "pages/_app.js",
        "/en/_document": "pages/_document.js",
        "/en/customers/new": "pages/customers/new.js",
        "/nl": "pages/index.js",
        "/nl/_app": "pages/_app.js",
        "/nl/_document": "pages/_document.js",
        "/nl/customers/new": "pages/customers/new.js"
      });

      expect(html).toEqual({
        nonDynamic: {
          "/404": "pages/404.html",
          "/terms": "pages/terms.html",
          "/about": "pages/about.html",
          "/en/404": "pages/en/404.html",
          "/en/terms": "pages/en/terms.html",
          "/en/about": "pages/en/about.html",
          "/nl/404": "pages/nl/404.html",
          "/nl/terms": "pages/nl/terms.html",
          "/nl/about": "pages/nl/about.html"
        },
        dynamic: {
          "/blog/:post": {
            file: "pages/blog/[post].html",
            regex: expect.any(String)
          },
          "/en/blog/:post": {
            file: "pages/en/blog/[post].html",
            regex: expect.any(String)
          },
          "/nl/blog/:post": {
            file: "pages/nl/blog/[post].html",
            regex: expect.any(String)
          }
        }
      });

      expect(ssg).toEqual({
        nonDynamic: {
          "/": {
            dataRoute: "/_next/data/test-build-id/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/contact": {
            dataRoute: "/_next/data/test-build-id/contact.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en": {
            dataRoute: "/_next/data/test-build-id/en/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/en/contact": {
            dataRoute: "/_next/data/test-build-id/en/contact.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl": {
            dataRoute: "/_next/data/test-build-id/nl/index.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          },
          "/nl/contact": {
            dataRoute: "/_next/data/test-build-id/nl/contact.json",
            initialRevalidateSeconds: false,
            srcRoute: null
          }
        },
        dynamic: {}
      });

      expect(publicFiles).toEqual({
        "/favicon.ico": "favicon.ico",
        "/sub/image.png": "sub/image.png",
        "/sw.js": "sw.js"
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

  describe("Default Handler", () => {
    it("copies build files", async () => {
      expect.assertions(7);

      const files = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}`)
      );
      const pages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages`)
      );
      const customerPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/customers`)
      );
      const apiDirExists = await fse.pathExists(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/api`)
      );

      expect(files).toEqual([
        "index.js",
        "manifest.json",
        "pages",
        "prerender-manifest.json",
        "routes-manifest.json"
      ]);

      // api pages should not be included in the default lambda
      expect(apiDirExists).toEqual(false);

      // HTML Prerendered pages or JSON static props files
      // should not be included in the default lambda
      expect(pages).not.toContain(["blog.json", "index.json", "contact.json"]);
      expect(pages).not.toContain([
        "about.html",
        "terms.html",
        "contact.html",
        "index.html"
      ]);

      // JS files used only for prerendering at build time (contact.js, index.js) are not included since there are no API routes
      expect(pages).not.toContain(["contact.js", "index.js"]);

      // Default lambda has locale directories "en", "nl" but they are empty for now
      expect(pages).toEqual(["_error.js", "blog.js", "customers", "en", "nl"]);
      expect(customerPages).toEqual(["[...catchAll].js", "[post].js"]);
    });
  });

  describe("Assets", () => {
    it("copies locale-specific asset files", async () => {
      expect.assertions(11);
      // Root
      const nextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id`)
      );
      expect(nextDataFiles).toEqual(["contact.json", "en", "index.json", "nl"]);

      // English
      const enNextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/en`)
      );
      expect(enNextDataFiles).toEqual(["contact.json", "index.json"]);

      const enIndexJson = await fse.readFile(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/en/index.json`),
        "utf8"
      );
      expect(enIndexJson).toBe('"en"');

      const enPageFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/en`)
      );
      expect(enPageFiles).toEqual(["contact.html", "index.html"]);

      const enIndexHtml = await fse.readFile(
        join(
          outputDir,
          `${ASSETS_DIR}/static-pages/test-build-id/en/index.html`
        ),
        "utf8"
      );
      expect(enIndexHtml).toBe("en");

      // Dutch
      const nlNextDataFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/nl`)
      );
      expect(nlNextDataFiles).toEqual(["contact.json", "index.json"]);

      const nlIndexJson = await fse.readFile(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/nl/index.json`),
        "utf8"
      );
      expect(nlIndexJson).toBe('"nl"');

      const nlPageFiles = await fse.readdir(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/nl`)
      );
      expect(nlPageFiles).toEqual(["contact.html", "index.html"]);

      const nlIndexHtml = await fse.readFile(
        join(
          outputDir,
          `${ASSETS_DIR}/static-pages/test-build-id/nl/index.html`
        ),
        "utf8"
      );
      expect(nlIndexHtml).toBe("nl");

      // Default locale: English.
      const defaultIndexJson = await fse.readFile(
        join(outputDir, `${ASSETS_DIR}/_next/data/test-build-id/index.json`),
        "utf8"
      );
      expect(defaultIndexJson).toBe('"en"');

      const defaultIndexHtml = await fse.readFile(
        join(outputDir, `${ASSETS_DIR}/static-pages/test-build-id/index.html`),
        "utf8"
      );
      expect(defaultIndexHtml).toBe("en");
    });
  });
});
