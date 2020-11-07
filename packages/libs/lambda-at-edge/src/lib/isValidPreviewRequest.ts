import cookie from "cookie";
import jsonwebtoken from "jsonwebtoken";

import type { CloudFrontRequest } from "aws-lambda";
import type { PreRenderedManifest } from "../../types";

const NEXT_PREVIEW_DATA_COOKIE = "__next_preview_data";
const NEXT_PRERENDER_BYPASS_COOKIE = "__prerender_bypass";
const defaultPreviewCookies = {
  [NEXT_PRERENDER_BYPASS_COOKIE]: "",
  [NEXT_PREVIEW_DATA_COOKIE]: ""
};

type DefaultPreviewCookies = typeof defaultPreviewCookies;

/**
 * Determine if the request contains a valid signed JWT for preview mode
 *
 * @param request
 * @param prerenderManifest
 */
export const isValidPreviewRequest = (
  request: CloudFrontRequest,
  prerenderManifest: PreRenderedManifest
): boolean => {
  const previewCookies = getPreviewCookies(request);

  if (hasPreviewCookies(previewCookies)) {
    try {
      jsonwebtoken.verify(
        previewCookies[NEXT_PREVIEW_DATA_COOKIE],
        prerenderManifest.preview.previewModeSigningKey
      );

      return true;
    } catch (e) {
      console.warn("Failed preview mode verification for URI:", request.uri);
    }
  }

  return false;
};

// Private

const getPreviewCookies = (
  request: CloudFrontRequest
): DefaultPreviewCookies => {
  const targetCookie = request.headers.cookie || [];

  return targetCookie.reduce((previewCookies, cookieObj) => {
    const parsedCookie = cookie.parse(cookieObj.value);

    if (hasPreviewCookies(parsedCookie)) {
      return parsedCookie as DefaultPreviewCookies;
    }

    return previewCookies;
  }, defaultPreviewCookies);
};

const hasPreviewCookies = (cookies: { [key: string]: string }): boolean =>
  !!(
    cookies[NEXT_PREVIEW_DATA_COOKIE] && cookies[NEXT_PRERENDER_BYPASS_COOKIE]
  );
