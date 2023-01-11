import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";

jest.mock(
  "../../src/manifest.json",
  () => require("./default-build-manifest-with-basic-auth.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/prerender-manifest.json",
  () => require("./prerender-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/images-manifest.json",
  () => require("./images-manifest.json"),
  {
    virtual: true
  }
);

jest.mock(
  "../../src/routes-manifest.json",
  () => require("./default-routes-manifest.json"),
  {
    virtual: true
  }
);

jest.mock("@aws-sdk/client-cloudfront/CloudFrontClient", () =>
  require("../mocks/cloudfront/aws-sdk-cloudfront-client.mock")
);

jest.mock("@aws-sdk/client-lambda/LambdaClient", () =>
  require("../mocks/lambda/aws-sdk-lambda-client.mock")
);

jest.mock("@aws-sdk/client-s3/S3Client", () =>
  require("../mocks/s3/aws-sdk-s3-client.mock")
);

jest.mock("@aws-sdk/client-s3/commands/GetObjectCommand", () =>
  require("../mocks/s3/aws-sdk-s3-client-get-object-command.mock")
);

jest.mock("@aws-sdk/client-s3/commands/PutObjectCommand", () =>
  require("../mocks/s3/aws-sdk-s3-client-put-object-command.mock")
);

describe("Lambda@Edge", () => {
  describe("Basic Authentication", () => {
    it.each`
      usernamePassword | expectedAuthenticateSuccess
      ${"test:123"}    | ${true}
      ${"test:wrong"}  | ${false}
    `(
      "for $usernamePassword, authenticated successfully: $expectedAuthenticateSuccess",
      async ({ usernamePassword, expectedAuthenticateSuccess }) => {
        const event = createCloudFrontEvent({
          uri: "/",
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

        const response = await handler(event);

        if (expectedAuthenticateSuccess) {
          expect(response).toEqual({
            clientIp: "1.2.3.4",
            headers: {
              authorization: [
                { key: "Authorization", value: "Basic dGVzdDoxMjM=" }
              ],
              host: [{ key: "host", value: "my-bucket.s3.amazonaws.com" }]
            },
            method: "GET",
            origin: {
              s3: {
                authMethod: "origin-access-identity",
                domainName: "my-bucket.s3.amazonaws.com",
                path: "/static-pages/build-id2",
                region: "us-east-1"
              }
            },
            querystring: "",
            uri: "/index.html"
          });
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
