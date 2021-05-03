import { Header, Response } from "./types";

export function getUnauthenticatedResponse(
  authorizationHeaders: Header[] | null,
  authentication: { username: string; password: string } | undefined
): Response | null {
  if (authentication && authentication.username && authentication.password) {
    const validAuth =
      "Basic " +
      Buffer.from(
        authentication.username + ":" + authentication.password
      ).toString("base64");

    if (!authorizationHeaders || authorizationHeaders[0]?.value !== validAuth) {
      return {
        status: "401",
        statusDescription: "Unauthorized",
        body: "Unauthorized",
        headers: {
          "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
        }
      };
    }
  }

  return null;
}
