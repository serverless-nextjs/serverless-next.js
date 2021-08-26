import cookie from "cookie";
import jsonwebtoken from "jsonwebtoken";
import { CloudFrontRequest } from "aws-lambda";
import { IncomingMessage } from "http";
import { decryptWithSecret, encryptWithSecret } from "./crypto-utils";

const NEXT_PREVIEW_DATA_COOKIE = "__next_preview_data";
const NEXT_PRERENDER_BYPASS_COOKIE = "__prerender_bypass";
const JERRY_AUTH_COOKIE = "jerryauth";
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
 * For next preview data, it is a JWT.
 * And the JWT pay load is {data: encrypted payload string}.
 */
export type PreviewData = {
  data: string;
};

/**
 * For now, the preview data payload will only be empty object or object with a 'token' property.
 */
export type PreviewDataPayload = {
  token?: string;
};

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

/**
 * Get Jerry auth token from cloudfront request and set it to renderer request.
 * Workaround for fixing token can't be set in preview api.
 *
 * @param cloudfrontRequest
 * @param renderRequest
 * @param signingKey
 * @param encryptionKey
 */
export const setJerryAuth = (
  cloudfrontRequest: CloudFrontRequest,
  renderRequest: IncomingMessage,
  signingKey: string,
  encryptionKey: string
): void => {
  const cloudFrontCookie = cloudfrontRequest.headers.cookie?.[0]?.value ?? "";

  // 1. get encrypted preview data payload.
  const encryptedPreviewDataPayload = getPreviewData(
    cloudFrontCookie,
    signingKey
  )?.data;
  if (!encryptedPreviewDataPayload) return;

  // 2. decrypt
  const decryptedPreviewDataPayload = decryptPreviewData(
    encryptionKey,
    encryptedPreviewDataPayload
  );

  // 3. add jerry auth token to payload
  setJerryAuthToken(decryptedPreviewDataPayload, cloudFrontCookie);

  // 4. sign JWT
  const previewJwt = signPreviewData(
    encryptionKey,
    signingKey,
    decryptedPreviewDataPayload
  );

  // 5. overwrite next preview data cookie
  renderRequest.headers = {
    ...renderRequest.headers,
    cookie: `${NEXT_PREVIEW_DATA_COOKIE}=${
      previewJwt ?? defaultPreviewCookies[NEXT_PREVIEW_DATA_COOKIE]
    }; ${NEXT_PRERENDER_BYPASS_COOKIE}=${
      getPreRenderBypass(cloudFrontCookie) ??
      defaultPreviewCookies[NEXT_PRERENDER_BYPASS_COOKIE]
    }`
  };
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

/**
 * Decrypt preview data.
 * @param encryptionKey
 * @param data
 */
const decryptPreviewData = (
  encryptionKey: string,
  data: string
): PreviewDataPayload =>
  JSON.parse(
    decryptWithSecret(Buffer.from(encryptionKey), data)
  ) as PreviewDataPayload;

/**
 * Add jerry auth token to preview data payload if need.
 *
 * @param decryptedPreviewData
 * @param cookie
 */
const setJerryAuthToken = (
  decryptedPreviewData: PreviewDataPayload,
  cookie: string
) => {
  decryptedPreviewData.token =
    decryptedPreviewData.token ?? getJerryAuth(cookie);
};

/**
 * Sign preview data payload to JWT.
 *
 * @param encryptionKey
 * @param signingKey
 * @param payLoad
 */
const signPreviewData = (
  encryptionKey: string,
  signingKey: string,
  payLoad: PreviewDataPayload
): string | undefined => {
  try {
    return jsonwebtoken.sign(
      {
        data: encryptWithSecret(
          Buffer.from(encryptionKey),
          JSON.stringify(payLoad)
        )
      },
      signingKey
    );
  } catch (e) {
    console.warn(e);
    return undefined;
  }
};

const getOneFromCookieString = (
  cookie: string,
  key: string
): string | undefined => {
  const value = `; ${cookie}`;
  const parts = value.split(`; ${key}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
};

export const getPreviewData = (
  cookie: string,
  signingKey: string
): PreviewData | undefined => {
  const previewDataCookieInJwtFormat = getOneFromCookieString(
    cookie,
    NEXT_PREVIEW_DATA_COOKIE
  );
  try {
    return previewDataCookieInJwtFormat
      ? (jsonwebtoken.verify(
          previewDataCookieInJwtFormat,
          signingKey
        ) as PreviewData)
      : undefined;
  } catch (e) {
    console.warn(e);
    return undefined;
  }
};

const getJerryAuth = (cookie: string): string | undefined => {
  return getOneFromCookieString(cookie, JERRY_AUTH_COOKIE);
};

const getPreRenderBypass = (cookie: string): string | undefined => {
  return getOneFromCookieString(cookie, NEXT_PRERENDER_BYPASS_COOKIE);
};
