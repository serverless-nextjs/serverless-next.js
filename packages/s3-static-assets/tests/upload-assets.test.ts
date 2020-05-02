import path from "path";
import uploadStaticAssets from "../src/index";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "../src/lib/constants";
import AWS, { mockGetBucketAccelerateConfiguration, mockUpload } from "aws-sdk";
import { mockGetBucketAccelerateConfigurationPromise } from "../__mocks__/aws-sdk";

const upload = (): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  return uploadStaticAssets({
    bucketName: "test-bucket-name",
    nextConfigDir: path.join(__dirname, "./fixtures/basic-next-app"),
    credentials: {
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    }
  });
};

describe("Upload tests", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("passes credentials to S3 client", async () => {
    await upload();

    expect(AWS.S3).toBeCalledWith({
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    });
  });

  it("uses accelerated bucket option if available", async () => {
    mockGetBucketAccelerateConfigurationPromise.mockResolvedValueOnce({
      Status: "Enabled"
    });

    await upload();

    expect(AWS.S3).toBeCalledTimes(2);
    expect(AWS.S3).toBeCalledWith({
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token",
      useAccelerateEndpoint: true
    });
    expect(mockGetBucketAccelerateConfiguration).toBeCalledWith({
      Bucket: "test-bucket-name"
    });
  });

  it("falls back to non accelerated client if checking for bucket acceleration throws an error", async () => {
    mockGetBucketAccelerateConfigurationPromise.mockRejectedValueOnce(
      new Error("Unexpected error!")
    );

    await upload();

    expect(consoleWarnSpy).toBeCalledWith(
      expect.stringContaining("falling back")
    );
    expect(AWS.S3).toBeCalledTimes(1);
  });

  it("uploads any contents inside build directory specified in BUILD_ID", async () => {
    await upload();

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
    await upload();

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
    await upload();

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
    await upload();

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
