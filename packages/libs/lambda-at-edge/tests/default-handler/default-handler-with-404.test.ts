import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import { CloudFrontRequest, CloudFrontResultResponse } from "aws-lambda";

jest.mock(
  "../../src/manifest.json",
  () => require("./default-build-manifest-with-404.json"),
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
  "../../src/routes-manifest.json",
  () => require("./default-routes-manifest.json"),
  {
    virtual: true
  }
);

describe("Lambda@Edge", () => {
  it("renders a static 404 page if request path can't be matched to any page / api routes and a 404.html was generated", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.s3.amazonaws.com"
        }
      },
      config: { eventType: "origin-request" } as any
    });

    const request = (await handler(event)) as CloudFrontRequest;

    expect(request.uri).toEqual("/404.html");
  });

  it.each`
    path
    ${"/_next/data/unmatched"}
  `(
    "renders a static 404 page if data request can't be matched for path: $path",
    async ({ path }) => {
      const event = createCloudFrontEvent({
        uri: path,
        origin: {
          s3: {
            domainName: "my-bucket.s3.amazonaws.com"
          }
        },
        config: { eventType: "origin-request" } as any
      });

      const request = (await handler(event)) as CloudFrontRequest;

      expect(request.uri).toEqual("/404.html");
    }
  );

  it("static 404 page should return CloudFront 404 status code after successful S3 origin response", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net",
      config: { eventType: "origin-response" } as any,
      response: {
        status: "200"
      } as any
    });

    const response = (await handler(event)) as CloudFrontResultResponse;

    expect(response.status).toEqual("404");
  });
});
