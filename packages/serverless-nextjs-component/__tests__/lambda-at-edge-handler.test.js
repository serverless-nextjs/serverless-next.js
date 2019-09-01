const { handler } = require("../lambda-at-edge-handler");

jest.mock("../manifest.json", () => require("./fixtures/manifest.json"), {
  virtual: true
});

const createCloudFrontEvent = ({ uri, host, origin }) => ({
  Records: [
    {
      cf: {
        request: {
          uri,
          headers: {
            host: [
              {
                key: "host",
                value: host
              }
            ]
          },
          origin
        }
      }
    }
  ]
});

describe("Lambda@Edge", () => {
  it("forwards the request to api gateway when path is ssr", async () => {
    const event = createCloudFrontEvent({
      uri: "/blog/howtodance",
      host: "mydistribution.cloudfront.net",
      origin: {
        ssr: {
          domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
        }
      }
    });

    const request = await handler(event, {});

    expect(request.headers["host"]).toEqual([
      {
        key: "host",
        value: "ssr-api.execute-api.us-east-1.amazonaws.com"
      }
    ]);
    expect(request.uri).toEqual("/blog/howtodance");
  });

  it("forwards the request to S3 when path is static", async () => {
    const event = createCloudFrontEvent({
      uri: "/terms",
      host: "mydistribution.cloudfront.net",
      origin: {
        ssr: {
          domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
        }
      }
    });

    const request = await handler(event, {});

    expect(request.origin).toEqual({
      s3: {
        authMethod: "none",
        domainName: "my-bucket.s3.amazonaws.com",
        path: "/static-pages"
      }
    });
    expect(request.headers["host"]).toEqual([
      {
        key: "host",
        value: "my-bucket.s3.amazonaws.com"
      }
    ]);
    expect(request.uri).toEqual("/terms.html");
  });

  it("forwards the request to S3 when is public file", async () => {
    const event = createCloudFrontEvent({
      uri: "/manifest.json",
      host: "mydistribution.cloudfront.net",
      origin: {
        ssr: {
          domainName: "ssr-api.execute-api.us-east-1.amazonaws.com"
        }
      }
    });

    const request = await handler(event, {});

    expect(request.origin).toEqual({
      s3: {
        authMethod: "none",
        domainName: "my-bucket.s3.amazonaws.com",
        path: "/public"
      }
    });
    expect(request.headers["host"]).toEqual([
      {
        key: "host",
        value: "my-bucket.s3.amazonaws.com"
      }
    ]);
    expect(request.uri).toEqual("/manifest.json");
  });
});
