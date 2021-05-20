interface StaticRegenerationResponseOptions {
  // Header as set on the origin object
  expiresHeader: string;
  lastModifiedHeader: string | undefined;
  initialRevalidateSeconds?: false | number;
}

interface StaticRegenerationResponseValue {
  // Cache-Control header
  cacheControl: string;
  secondsRemainingUntilRevalidation: number;
}

const firstRegenerateExpiryDate = (
  lastModifiedHeader: string,
  initialRevalidateSeconds: number
) => {
  return new Date(
    new Date(lastModifiedHeader).getTime() + initialRevalidateSeconds * 1000
  );
};

/**
 * Function called within an origin response as part of the Incremental Static
 * Regeneration logic. Returns required headers for the response, or false if
 * this response is not compatible with ISR.
 */
export const getStaticRegenerationResponse = (
  options: StaticRegenerationResponseOptions
): StaticRegenerationResponseValue | false => {
  const { initialRevalidateSeconds } = options;

  // ISR pages that were either previously regenerated or generated
  // post-initial-build, will have an `Expires` header set. However ISR pages
  // that have not been regenerated but at build-time resolved a revalidate
  // property will not have an `Expires` header and therefore we check using the
  // manifest.
  if (
    !options.expiresHeader &&
    !(
      options.lastModifiedHeader && typeof initialRevalidateSeconds === "number"
    )
  ) {
    return false;
  }

  const expiresAt = options.expiresHeader
    ? new Date(options.expiresHeader)
    : firstRegenerateExpiryDate(
        options.lastModifiedHeader as string,
        initialRevalidateSeconds as number
      );

  const secondsRemainingUntilRevalidation = Math.ceil(
    Math.max(0, (expiresAt.getTime() - Date.now()) / 1000)
  );

  return {
    secondsRemainingUntilRevalidation,
    cacheControl: `public, max-age=0, s-maxage=${secondsRemainingUntilRevalidation}, must-revalidate`
  };
};

export const getThrottledStaticRegenerationCachePolicy = (
  expiresInSeconds: number
): StaticRegenerationResponseValue => {
  return {
    secondsRemainingUntilRevalidation: expiresInSeconds,
    cacheControl: `public, max-age=0, s-maxage=${expiresInSeconds}, must-revalidate`
  };
};
