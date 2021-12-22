import { IncomingMessage, ServerResponse } from "http";
import fresh from "fresh";

export function sendEtagResponse(
  req: IncomingMessage,
  res: ServerResponse,
  etag: string | undefined
): boolean {
  if (etag) {
    /**
     * The server generating a 304 response MUST generate any of the
     * following header fields that would have been sent in a 200 (OK)
     * response to the same request: Cache-Control, Content-Location, Date,
     * ETag, Expires, and Vary. https://tools.ietf.org/html/rfc7232#section-4.1
     */
    res.setHeader("ETag", `"${etag}"`);
  }

  if (fresh(req.headers, { etag: `"${etag}"` })) {
    res.statusCode = 304;
    res.end();
    return true;
  }

  return false;
}
