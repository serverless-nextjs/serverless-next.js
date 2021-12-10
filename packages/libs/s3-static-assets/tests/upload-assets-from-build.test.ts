import path from "path";
import { uploadStaticAssetsFromBuild } from "../src/index";
import {
  IMMUTABLE_CACHE_CONTROL_HEADER,
  SERVER_NO_CACHE_CACHE_CONTROL_HEADER,
  SERVER_CACHE_CONTROL_HEADER
} from "../src/lib/constants";
import AWS, {
  mockGetBucketAccelerateConfigurationPromise,
  mockGetBucketAccelerateConfiguration,
  mockUpload
} from "aws-sdk";

// unfortunately can't use __mocks__ because aws-sdk is being mocked in other
// packages in the monorepo
// https://github.com/facebook/jest/issues/2070
jest.mock("aws-sdk", () => require("./aws-sdk.mock"));

const upload = (
  nextConfigDir: string,
  nextStaticDir?: string,
  basePath?: string,
  publicAssetCache?:
    | boolean
    | {
        test?: string;
        value?: string;
      }
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  let staticDir = nextStaticDir;

  if (nextStaticDir) {
    staticDir = path.join(__dirname, nextStaticDir);
  }

  return uploadStaticAssetsFromBuild({
    bucketName: "test-bucket-name",
    bucketRegion: "us-east-1",
    basePath: basePath || "",
    nextConfigDir: path.join(__dirname, nextConfigDir),
    nextStaticDir: staticDir,
    credentials: {
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    },
    publicDirectoryCache: publicAssetCache
  });
};

describe("Upload tests from build", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("passes credentials to S3 client", async () => {
    await upload("./fixtures/app-basic-upload-from-build");

    expect(AWS.S3).toBeCalledWith({
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      s3BucketEndpoint: false,
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    });
  });

  it("uses accelerated bucket option if available", async () => {
    mockGetBucketAccelerateConfigurationPromise.mockResolvedValueOnce({
      Status: "Enabled"
    });

    await upload("./fixtures/app-basic-upload-from-build");

    expect(AWS.S3).toBeCalledTimes(2);
    expect(AWS.S3).toBeCalledWith({
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      s3BucketEndpoint: false,
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

    await upload("./fixtures/app-basic-upload-from-build");

    expect(consoleWarnSpy).toBeCalledWith(
      expect.stringContaining("falling back")
    );
    expect(AWS.S3).toBeCalledTimes(1);
  });
});

describe.each`
  nextConfigDir                               | nextStaticDir
  ${"./fixtures/app-basic-upload-from-build"} | ${undefined}
`(
  "Content Upload Tests - nextConfigDir=$nextConfigDir, nextStaticDir=$nextStaticDir",
  ({ nextConfigDir, nextStaticDir }) => {
    beforeEach(async () => {
      await upload(nextConfigDir, nextStaticDir);
    });

    it("uploads static files in _next/static", () => {
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

    it("uploads HTML pages in static-pages", () => {
      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/zsWqBqLjpgRmswfQomanp/todos/terms.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/zsWqBqLjpgRmswfQomanp/todos/terms/[section].html",
          ContentType: "text/html",
          CacheControl: SERVER_NO_CACHE_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/zsWqBqLjpgRmswfQomanp/todos/terms/a.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/zsWqBqLjpgRmswfQomanp/todos/terms/b.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );
    });

    it("uploads staticProps JSON files in _next/data", () => {
      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/index.json",
          ContentType: "application/json",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/fr/todos/terms/c.json",
          ContentType: "application/json",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/todos/terms/a.json",
          ContentType: "application/json",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/todos/terms/b.json",
          ContentType: "application/json",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );
    });

    it("uploads files in the public folder", () => {
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

    it("uploads files in the static folder", () => {
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
  }
);

describe.each`
  nextConfigDir                                        | nextStaticDir
  ${"./fixtures/app-basic-upload-from-build-basepath"} | ${undefined}
`(
  "Content Upload Tests - nextConfigDir=$nextConfigDir, nextStaticDir=$nextStaticDir",
  ({ nextConfigDir, nextStaticDir }) => {
    it("supports basePath", async () => {
      await upload(nextConfigDir, nextStaticDir, "/basepath");

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "basepath/static/robots.txt",
          ContentType: "text/plain",
          CacheControl: undefined
        })
      );
    });
  }
);
