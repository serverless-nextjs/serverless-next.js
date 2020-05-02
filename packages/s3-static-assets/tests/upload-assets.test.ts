import AWS from "aws-sdk";
import path from "path";
import uploadStaticAssets from "../src/index";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "../src/lib/constants";
import { mockUpload } from "aws-sdk";

declare module "aws-sdk" {
  const mockUpload: jest.Mock;
}

describe("Upload assets tests", () => {
  beforeEach(async () => {
    await uploadStaticAssets({
      bucketName: "test-bucket-name",
      nextConfigDir: path.join(__dirname, "./fixtures/basic-next-app"),
      credentials: {
        accessKeyId: "fake-access-key",
        secretAccessKey: "fake-secret-key",
        sessionToken: "fake-session-token"
      }
    });
  });

  it("passes credentials to S3 client", () => {
    expect(AWS.S3).toBeCalledWith({
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    });
  });

  it("uploads any contents inside build directory specified in BUILD_ID", async () => {
    expect(mockUpload).toBeCalledWith({
      Bucket: "test-bucket-name",
      Key: "_next/static/a_test_build_id/two.js",
      Body: expect.any(Buffer),
      ContentType: "application/javascript",
      CacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
    });

    expect(mockUpload).toBeCalledWith({
      Bucket: "test-bucket-name",
      Key: "_next/static/a_test_build_id/css/one.css",
      Body: expect.any(Buffer),
      ContentType: "text/css",
      CacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
    });
  });

  it("uploads prerendered HTML pages specified in pages manifest", async () => {
    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "static-pages/todos/terms.html",
        ContentType: "text/html",
        CacheControl: undefined
      })
    );

    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "static-pages/todos/terms/[section].html",
        ContentType: "text/html",
        CacheControl: undefined
      })
    );
  });

  it("uploads files in the public folder", async () => {
    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "public/robots.txt",
        ContentType: "text/plain",
        CacheControl: undefined
      })
    );

    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "public/scripts/test-script.js",
        ContentType: "application/javascript",
        CacheControl: undefined
      })
    );
  });

  it("uploads files in the static folder", async () => {
    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "static/robots.txt",
        ContentType: "text/plain",
        CacheControl: undefined
      })
    );

    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "static/scripts/test-script.js",
        ContentType: "application/javascript",
        CacheControl: undefined
      })
    );
  });
});
