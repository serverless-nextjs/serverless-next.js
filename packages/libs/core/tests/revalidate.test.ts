import { getStaticRegenerationResponse } from "../src/revalidate";

describe("revalidate", () => {
  describe("getStaticRegenerationResponse()", () => {
    it("should return a cache header at the amount defined as the initialRevalidateSeconds relative to the lastModifiedHeader when no Expires header is passed", () => {
      const date = new Date().toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: date,
        initialRevalidateSeconds: 10
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=10, must-revalidate`
      );
    });

    it("should return a cache header at for the time relative to now and the expires header", () => {
      const date = new Date(Date.now() + 5000).toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: date,
        lastModifiedHeader: ""
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=5, must-revalidate`
      );
    });

    it("should prioritise using the Expires header if both Expires header and last modified are present", () => {
      const lastModifiedHeader = new Date().toJSON();
      const expiresHeader = new Date(Date.now() + 2000).toJSON();
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: expiresHeader,
        lastModifiedHeader: lastModifiedHeader
      });

      if (!staticRegeneratedResponse) {
        throw new Error("Expected staticRegeneratedResponse to be truthy");
      }

      expect(staticRegeneratedResponse.cacheControl).toBe(
        `public, max-age=0, s-maxage=2, must-revalidate`
      );
    });

    it("should return false when no headers are passed", () => {
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: ""
      });

      expect(staticRegeneratedResponse).toBe(false);
    });

    it("should return false when no Expires header is passed, and there is no initial validation seconds in manifest", () => {
      const staticRegeneratedResponse = getStaticRegenerationResponse({
        expiresHeader: "",
        lastModifiedHeader: new Date().toJSON()
      });

      expect(staticRegeneratedResponse).toBe(false);
    });
  });
});
