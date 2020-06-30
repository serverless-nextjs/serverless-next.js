import { handler } from "../../src/default-handler";
import { createCloudFrontEvent } from "../test-utils";
import { CloudFrontResultResponse } from "aws-lambda";

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

describe("Lambda@Edge", () => {
  it("renders a static 404 page if request path can't be matched to any page / api routes and a 404.html was generated", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.s3.amazonaws.com"
        }
      }
    });

    const response = (await handler(event)) as CloudFrontResultResponse;

    expect(response.uri).toEqual("/404.html");
  });
});
