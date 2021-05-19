/**
 * Removes html and adds the trailing slash if needed. This is used when
 * regenerating an SSG page.
 */
export const cleanRequestUriForRouter = (
  uri: string,
  trailingSlash?: boolean
): string => {
  if (uri.endsWith(".html")) {
    uri = uri.slice(0, uri.length - 5);
    if (trailingSlash) {
      uri += "/";
    }
  }
  return uri;
};
