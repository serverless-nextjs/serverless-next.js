import { Header, UnauthorizedRoute } from "../types";

export function getUnauthenticatedResponse(
  authorizationHeaders: Header[] | null,
  authentication: { username: string; password: string } | undefined
): UnauthorizedRoute | undefined {
  if (authentication && authentication.username && authentication.password) {
    const validAuth =
      "Basic " +
      Buffer.from(
        authentication.username + ":" + authentication.password
      ).toString("base64");

    if (!authorizationHeaders || authorizationHeaders[0]?.value !== validAuth) {
      return {
        isUnauthorized: true,
        status: 401,
        statusDescription: "Unauthorized",
        body: "Unauthorized",
        headers: {
          "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
        }
      };
    }
  }
}
