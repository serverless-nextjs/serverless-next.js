/**
 * Normalise domain redirects by validating they are URLs and getting rid of trailing slash.
 * @param domainRedirects
 */
export const normaliseDomainRedirects = (unnormalisedDomainRedirects: {
  [key: string]: string;
}) => {
  const domainRedirects = { ...unnormalisedDomainRedirects };
  for (const key in domainRedirects) {
    const destination = domainRedirects[key];

    let url;
    try {
      url = new URL(destination);
    } catch (error) {
      throw new Error(
        `domainRedirects: ${destination} is invalid. The URL is not in a valid URL format.`
      );
    }

    const { origin, pathname, searchParams } = url;

    if (!origin.startsWith("https://") && !origin.startsWith("http://")) {
      throw new Error(
        `domainRedirects: ${destination} is invalid. The URL must start with http:// or https://.`
      );
    }

    if (Array.from(searchParams).length > 0) {
      throw new Error(
        `domainRedirects: ${destination} is invalid. The URL must not contain query parameters.`
      );
    }

    let normalizedDomain = `${origin}${pathname}`;
    normalizedDomain = normalizedDomain.endsWith("/")
      ? normalizedDomain.slice(0, -1)
      : normalizedDomain;

    domainRedirects[key] = normalizedDomain;
  }
  return domainRedirects;
};
