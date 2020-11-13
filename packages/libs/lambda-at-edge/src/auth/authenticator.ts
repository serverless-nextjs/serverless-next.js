import { CloudFrontResultResponse } from "aws-lambda";

export function getUnauthenticatedResponse(
  authorizationHeader: string | null,
  authentication: { username: string; password: string } | undefined
): CloudFrontResultResponse | null {
  if (authentication && authentication.username && authentication.password) {
    const validAuth =
      "Basic " +
      Buffer.from(
        authentication.username + ":" + authentication.password
      ).toString("base64");

    if (authorizationHeader !== validAuth) {
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
