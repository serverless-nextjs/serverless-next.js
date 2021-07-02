import { isValidPreviewRequest, Cookies } from "../../src/route/preview";

import jsonwebtoken from "jsonwebtoken";

const previewModeSigningKey = "secret-key-sign";

describe("isValidPreviewRequest", () => {
  describe("with preview mode disabled", () => {
    it("is falsey for missing preview cookies", () => {
      const cookies: Cookies = [
        {
          key: "cookie",
          value: "user-session=12345;"
        }
      ];

      expect(
        isValidPreviewRequest(cookies, previewModeSigningKey)
      ).resolves.toEqual(false);
    });

    it("is falsey for invalid preview cookies", () => {
      const cookies: Cookies = [
        {
          key: "cookie",
          value:
            "user-session=12345; __next_preview_data=$incorrect-token; __prerender_bypass=def"
        }
      ];

      expect(
        isValidPreviewRequest(cookies, previewModeSigningKey)
      ).resolves.toEqual(false);
    });
  });

  describe("with preview mode enabled", () => {
    it("is truthy for valid jwt token in cookies", () => {
      const token = jsonwebtoken.sign("example-data", previewModeSigningKey);

      const cookies: Cookies = [
        {
          key: "Cookie",
          value: `user-session=12345; __next_preview_data=${token}; __prerender_bypass=def`
        }
      ];

      expect(
        isValidPreviewRequest(cookies, previewModeSigningKey)
      ).resolves.toEqual(true);
    });
  });
});
