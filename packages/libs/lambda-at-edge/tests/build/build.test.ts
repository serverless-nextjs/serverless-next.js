import { join } from "path";
import fse from "fs-extra";
import execa from "execa";
import Builder from "../../src/build";
import { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from "../../src/build";
import { cleanupDir, removeNewLineChars } from "../test-utils";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest
} from "../../types";

jest.mock("execa");

describe("Builder Tests", () => {
  const countLines = (text: string): number => {
    return text.split(/\r\n|\r|\n/).length;
  };

  let fseRemoveSpy: jest.SpyInstance;
  let fseEmptyDirSpy: jest.SpyInstance;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let apiBuildManifest: OriginRequestApiHandlerManifest;

  const fixturePath = join(__dirname, "./simple-app-fixture");
  const outputDir = join(fixturePath, ".test_sls_next_output");

  describe("Regular build", () => {
    beforeEach(async () => {
      const mockExeca = execa as jest.Mock;
      mockExeca.mockResolvedValueOnce();

      fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
        return;
      });
      fseEmptyDirSpy = jest.spyOn(fse, "emptyDir");

      const builder = new Builder(fixturePath, outputDir, {
        domainRedirects: {
          "example.com": "https://www.example.com",
          "another.com": "https://www.another.com/",
          "www.other.com": "https://other.com"
        }
      });
      await builder.build();

      defaultBuildManifest = await fse.readJSON(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
      );

      apiBuildManifest = await fse.readJSON(
        join(outputDir, `${API_LAMBDA_CODE_DIR}/manifest.json`)
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
        expect(fseRemoveSpy).not.toBeCalledWith(
          join(fixturePath, ".next/cache")
        );
      });

      it("output directory is cleanup before building", () => {
        expect(fseEmptyDirSpy).toBeCalledWith(
          expect.stringContaining(
            join(".test_sls_next_output", "default-lambda")
          )
        );
        expect(fseEmptyDirSpy).toBeCalledWith(
          expect.stringContaining(join(".test_sls_next_output", "api-lambda"))
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
            html
          },
          trailingSlash,
          domainRedirects
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
          }
        });

        expect(nonDynamic).toEqual({
          "/customers/new": "pages/customers/new.js",
          "/": "pages/index.js",
          "/_app": "pages/_app.js",
          "/_document": "pages/_document.js"
        });

        expect(html).toEqual({
          nonDynamic: {
            "/404": "pages/404.html",
            "/terms": "pages/terms.html",
            "/about": "pages/about.html"
          },
          dynamic: {
            "/blog/:post": {
              file: "pages/blog/[post].html",
              regex: expect.any(String)
            }
          }
        });

        expect(publicFiles).toEqual({
          "/favicon.ico": "favicon.ico",
          "/sub/image.png": "sub/image.png",
          "/sw.js": "sw.js"
        });

        expect(trailingSlash).toBe(false);

        expect(domainRedirects).toEqual({
          "example.com": "https://www.example.com",
          "another.com": "https://www.another.com",
          "www.other.com": "https://other.com"
        });
      });
    });

    describe("API Handler Manifest", () => {
      it("adds full api manifest", () => {
        const {
          apis: { dynamic, nonDynamic }
        } = apiBuildManifest;

        expect(nonDynamic).toEqual({
          "/api/customers": "pages/api/customers.js",
          "/api/customers/new": "pages/api/customers/new.js"
        });
        expect(dynamic).toEqual({
          "/api/customers/:id": {
            file: "pages/api/customers/[id].js",
            regex: expect.any(String)
          }
        });
      });
    });

    describe("Default Handler Artefact Files", () => {
      it("copies build files", async () => {
        expect.assertions(6);

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
        expect(pages).not.toContain([
          "blog.json",
          "index.json",
          "contact.json"
        ]);
        expect(pages).not.toContain([
          "about.html",
          "terms.html",
          "contact.html",
          "index.html"
        ]);

        // Note: JS files used only for prerendering at build time (contact.js, index.js) are included since there are API routes
        expect(pages).toEqual([
          "_error.js",
          "blog.js",
          "contact.js",
          "customers",
          "index.js"
        ]);
        expect(customerPages).toEqual(["[...catchAll].js", "[post].js"]);
      });

      it("default handler is not minified", async () => {
        const defaultHandler = await fse.readFile(
          join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/index.js`)
        );

        expect(countLines(defaultHandler.toString())).toBeGreaterThan(100); // Arbitrary choice
      });
    });

    describe("API Handler Artefact Files", () => {
      it("copies build files", async () => {
        expect.assertions(2);

        const files = await fse.readdir(
          join(outputDir, `${API_LAMBDA_CODE_DIR}`)
        );
        const pages = await fse.readdir(
          join(outputDir, `${API_LAMBDA_CODE_DIR}/pages`)
        );

        expect(files).toEqual([
          "index.js",
          "manifest.json",
          "pages",
          "routes-manifest.json"
        ]);
        expect(pages).toEqual(["api"]);
      });

      it("API handler is not minified", async () => {
        const apiHandler = await fse.readFile(
          join(outputDir, `${API_LAMBDA_CODE_DIR}/index.js`)
        );

        expect(countLines(apiHandler.toString())).toBeGreaterThan(100); // Arbitrary choice
      });
    });
  });

  describe("Minified handlers build", () => {
    beforeEach(async () => {
      const mockExeca = execa as jest.Mock;
      mockExeca.mockResolvedValueOnce();

      fseRemoveSpy = jest.spyOn(fse, "remove").mockImplementation(() => {
        return;
      });
      fseEmptyDirSpy = jest.spyOn(fse, "emptyDir");

      const builder = new Builder(fixturePath, outputDir, {
        minifyHandlers: true
      });
      await builder.build();
    });

    it("default handler is minified", async () => {
      const defaultHandler = await fse.readFile(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/index.js`)
      );

      expect(countLines(defaultHandler.toString())).toEqual(2);
    });

    it("API handler is minified", async () => {
      const apiHandler = await fse.readFile(
        join(outputDir, `${API_LAMBDA_CODE_DIR}/index.js`)
      );

      expect(countLines(apiHandler.toString())).toEqual(2);
    });
  });
});
