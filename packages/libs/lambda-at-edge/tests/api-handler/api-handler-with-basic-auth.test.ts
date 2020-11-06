import { createCloudFrontEvent } from "../test-utils";
import { handler } from "../../src/api-handler";

jest.mock(
  "../../src/manifest.json",
  () => require("./api-build-manifest-with-basic-auth.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./api-routes-manifest.json"),
  {
    virtual: true
  }
);

const mockPageRequire = (mockPagePath: string): void => {
  jest.mock(
    `../../src/${mockPagePath}`,
    () => require(`../shared-fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("API lambda handler", () => {
  describe("Basic Authentication", () => {
    it.each`
      usernamePassword | expectedAuthenticateSuccess
      ${"test:123"}    | ${true}
      ${"test:wrong"}  | ${false}
    `(
      "for $usernamePassword, authenticated successfully: $expectedAuthenticateSuccess",
      async ({ usernamePassword, expectedAuthenticateSuccess }) => {
        const event = createCloudFrontEvent({
          uri: "/api/getCustomers",
          host: "mydistribution.cloudfront.net",
          requestHeaders: {
            authorization: [
              {
                key: "Authorization",
                value:
                  "Basic " + Buffer.from(usernamePassword).toString("base64")
              }
            ]
          }
        });

        mockPageRequire("pages/api/getCustomers.js");

        let response = await handler(event);

        if (expectedAuthenticateSuccess) {
          const decodedBody = Buffer.from(
            response.body ?? "",
            "base64"
          ).toString("utf8");
          expect(decodedBody).toEqual("pages/api/getCustomers");
          expect(response.status).toEqual(200);
        } else {
          expect(response).toEqual({
            status: "401",
            statusDescription: "Unauthorized",
            body: "Unauthorized",
            headers: {
              "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
            }
          });
        }
      }
    );
  });
});
