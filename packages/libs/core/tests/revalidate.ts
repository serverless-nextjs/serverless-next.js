import { getStaticRegenerationResponse } from "../src/revalidate";
import { PageManifest, RoutesManifest } from "../src/types";
import initialRevalidateManifest from "./initial-revalidate-manifest.json";
import noInitialRevalidateManifest from "./no-initial-revalidate-manifest.json";

describe("revalidate", () => {
  describe("getStaticRegenerationResponse()", () => {
    const routesManifest = {
      basePath: "",
      redirects: [],
      rewrites: [],
      routes: []
    } as RoutesManifest;
    it("should return a cache header at the amount defined as the initialRevalidateSeconds relative to the lastModifiedHeader when no Expires header is passed", async () => {
      const date = new Date().toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: date,
        manifest: initialRevalidateManifest as PageManifest,
        routesManifest,
        requestedOriginUri: "/preview.html"
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=10, must-revalidate`
      );
    });

    it("should return a cache header at for the time relative to now and the expires header", async () => {
      const date = new Date(Date.now() + 5000).toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: date,
        lastModifiedHeader: "",
        manifest: initialRevalidateManifest as PageManifest,
        routesManifest,
        requestedOriginUri: "/preview.html"
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=5, must-revalidate`
      );
    });

    it("should prioritise using the Expires header if both Expires header and last modified are present", async () => {
      const lastModifiedHeader = new Date().toJSON();
      const expiresHeader = new Date(Date.now() + 2000).toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: expiresHeader,
        lastModifiedHeader: lastModifiedHeader,
        manifest: initialRevalidateManifest as PageManifest,
        routesManifest,
        requestedOriginUri: "/preview.html"
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=2, must-revalidate`
      );
    });

    it("should return false when no headers are passed", async () => {
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: "",
        manifest: initialRevalidateManifest as PageManifest,
        routesManifest,
        requestedOriginUri: "/preview.html"
      });

      expect(staticRegeneratedResponse).toBe(false);
    });

    it("should return false when no Expires header is passed, and there is no initial validation seconds in manifest", async () => {
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: new Date().toJSON(),
        manifest: noInitialRevalidateManifest as PageManifest,
        routesManifest,
        requestedOriginUri: "/preview.html"
      });

      expect(staticRegeneratedResponse).toBe(false);
    });
  });
});
