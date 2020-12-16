import cookie from "cookie";
import jsonwebtoken from "jsonwebtoken";

const NEXT_PREVIEW_DATA_COOKIE = "__next_preview_data";
const NEXT_PRERENDER_BYPASS_COOKIE = "__prerender_bypass";
const defaultPreviewCookies = {
  [NEXT_PRERENDER_BYPASS_COOKIE]: "",
  [NEXT_PREVIEW_DATA_COOKIE]: ""
};

type DefaultPreviewCookies = typeof defaultPreviewCookies;
export type Cookies = {
  key?: string | undefined;
  value: string;
}[];

/**
 * Determine if the request contains a valid signed JWT for preview mode
 *
 * @param cookies - Cookies header with cookies in RFC 6265 compliant format
 * @param previewModeSigningKey - Next build key generated in the preRenderManifest
 */
export const isValidPreviewRequest = (
  cookies: Cookies,
  previewModeSigningKey: string
): boolean => {
  const previewCookies = getPreviewCookies(cookies);

  if (hasPreviewCookies(previewCookies)) {
    try {
      jsonwebtoken.verify(
        previewCookies[NEXT_PREVIEW_DATA_COOKIE],
        previewModeSigningKey
      );

      return true;
    } catch (e) {
      console.warn("Found preview headers without valid authentication token");
    }
  }

  return false;
};

// Private

const getPreviewCookies = (cookies: Cookies): DefaultPreviewCookies => {
  const targetCookie = cookies || [];

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
