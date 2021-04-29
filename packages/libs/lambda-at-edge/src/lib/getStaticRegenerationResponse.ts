import { OriginRequestDefaultHandlerManifest } from "../types";

interface StaticRegenerationResponseOptions {
  // URI of the origin object
  requestedOriginUri: string;
  // Header as set on the origin object
  expiresHeader: string;
  manifest: OriginRequestDefaultHandlerManifest;
}

interface StaticRegenerationResponseValue {
  // Cache-Control header
  cacheControl: string;
  secondsRemainingUntilRevalidation: number;
}

/**
 * Function called within an origin response as part of the Incremental Static
 * Regeneration logic. Returns required headers for the response, or false if
 * this response is not compatible with ISR.
 */
const getStaticRegenerationResponse = (
  options: StaticRegenerationResponseOptions
): StaticRegenerationResponseValue | false => {
  const initialRevalidateSeconds =
    options.manifest.pages.ssg.nonDynamic?.[
      options.requestedOriginUri.replace(".html", "")
    ]?.initialRevalidateSeconds;

  // If this page did not write a revalidate value at build time it is not an
  // ISR page
  if (typeof initialRevalidateSeconds !== "number") {
    return false;
  }

  const expiresAt = new Date(options.expiresHeader);

  // isNaN will resolve true on initial load of this page (as the expiresHeader
  // won't be set), in which case we trigger a regeneration now
  const secondsRemainingUntilRevalidation = isNaN(expiresAt.getTime())
    ? 0
    : // Never return a negative amount of seconds if revalidation could have
      // happened sooner
      Math.floor(Math.max(0, (expiresAt.getTime() - Date.now()) / 1000));

  return {
    secondsRemainingUntilRevalidation,
    cacheControl: `public, max-age=0, s-maxage=${secondsRemainingUntilRevalidation}, must-revalidate`
  };
};

export { getStaticRegenerationResponse };
