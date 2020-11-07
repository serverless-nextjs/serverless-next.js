import { isValidPreviewRequest } from "../../src/lib/isValidPreviewRequest";

import type { CloudFrontRequest } from "aws-lambda";
import type { PreRenderedManifest } from "../../types";

import * as manifestFixture from "../default-handler/prerender-manifest.json";
const preRenderManifest = manifestFixture as PreRenderedManifest;

import jsonwebtoken from "jsonwebtoken";

const request: CloudFrontRequest = {
  clientIp: "0.0.0.0",
  headers: {
    "x-example": [
      {
        key: "Example",
        value: "Example Header"
      }
    ]
  },
  method: "GET",
  querystring: "",
  uri: "https://resource.com"
};

describe("isValidPreviewRequest", () => {
  describe("with preview mode disabled", () => {
    it("is falsey for missing preview cookies", () => {
      const currentRequest = { ...request };

      expect(isValidPreviewRequest(currentRequest, preRenderManifest)).toEqual(
        false
      );
    });
  });

  describe("with preview mode enabled", () => {
    it("is truthy for valid jwt token in cookies", () => {
      const token = jsonwebtoken.sign(
        "example-data",
        preRenderManifest.preview.previewModeSigningKey
      );

      const currentRequest = {
        ...request,
        headers: {
          cookie: [
            {
              key: "Cookie",
              value: `__next_preview_data=${token}; __prerender_bypass=def`
            }
          ]
        }
      };

      expect(isValidPreviewRequest(currentRequest, preRenderManifest)).toEqual(
        true
      );
    });
  });
});
