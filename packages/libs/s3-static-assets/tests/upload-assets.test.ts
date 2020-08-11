import path from "path";
import uploadStaticAssets from "../src/index";
import {
  IMMUTABLE_CACHE_CONTROL_HEADER,
  DEFAULT_PUBLIC_DIR_CACHE_CONTROL,
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

  return uploadStaticAssets({
    bucketName: "test-bucket-name",
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

describe("Upload tests shared", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("passes credentials to S3 client", async () => {
    await upload("./fixtures/app-basic");

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

    await upload("./fixtures/app-basic");

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

    await upload("./fixtures/app-basic");

    expect(consoleWarnSpy).toBeCalledWith(
      expect.stringContaining("falling back")
    );
    expect(AWS.S3).toBeCalledTimes(1);
  });

  it("uploads fallback pages for prerendered HTML pages specified in prerender manifest", async () => {
    await upload("./fixtures/app-with-fallback");

    expect(mockUpload).toBeCalledWith(
      expect.objectContaining({
        Key: "static-pages/fallback/[slug].html",
        ContentType: "text/html",
        CacheControl: SERVER_CACHE_CONTROL_HEADER
      })
    );
  });

  describe("when no public or static directory exists", () => {
    it("upload does not crash", () => upload("./fixtures/app-no-public-dir"));
  });
});

describe.each`
  nextConfigDir                                                   | nextStaticDir
  ${"./fixtures/app-basic"}                                       | ${undefined}
  ${"./fixtures/app-public-dir-in-custom-location/nextConfigDir"} | ${"./fixtures/app-public-dir-in-custom-location/nextStaticDir"}
`(
  "Content Upload Tests - nextConfigDir=$nextConfigDir, nextStaticDir=$nextStaticDir",
  ({ nextConfigDir, nextStaticDir }) => {
    it("uploads any contents inside the .next/static", async () => {
      await upload(nextConfigDir, nextStaticDir);

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

    it("uploads HTML pages specified in pages manifest", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms/[section].html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );
    });

    it("uploads staticProps JSON files specified in prerender manifest", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/index.json",
          ContentType: "application/json",
          CacheControl: undefined
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/todos/terms/a.json",
          ContentType: "application/json",
          CacheControl: undefined
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "_next/data/zsWqBqLjpgRmswfQomanp/todos/terms/b.json",
          ContentType: "application/json",
          CacheControl: undefined
        })
      );
    });

    it("uploads prerendered HTML pages specified in prerender manifest", async () => {
      await upload(nextConfigDir, nextStaticDir);

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms/a.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static-pages/todos/terms/b.html",
          ContentType: "text/html",
          CacheControl: SERVER_CACHE_CONTROL_HEADER
        })
      );
    });

    it("uploads files in the public folder", async () => {
      await upload(nextConfigDir, nextStaticDir);

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
      await upload(nextConfigDir, nextStaticDir);

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

describe.each`
  publicDirectoryCache                                          | expected
  ${undefined}                                                  | ${DEFAULT_PUBLIC_DIR_CACHE_CONTROL}
  ${false}                                                      | ${undefined}
  ${true}                                                       | ${DEFAULT_PUBLIC_DIR_CACHE_CONTROL}
  ${{ value: "public, max-age=36000" }}                         | ${"public, max-age=36000"}
  ${{ value: "public, max-age=36000", test: "/.(txt|xml)$/i" }} | ${undefined}
`(
  "Public directory cache settings - publicDirectoryCache=$publicDirectoryCache, expected=$expected",
  ({ publicDirectoryCache, expected }) => {
    beforeEach(async () => {
      await upload(
        "./fixtures/app-with-images",
        undefined,
        undefined,
        publicDirectoryCache
      );
    });

    it(`sets ${expected} for input value of ${publicDirectoryCache}`, () => {
      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "public/1x1.png",
          ContentType: "image/png",
          CacheControl: expected
        })
      );

      expect(mockUpload).toBeCalledWith(
        expect.objectContaining({
          Key: "static/1x1.png",
          ContentType: "image/png",
          CacheControl: expected
        })
      );
    });
  }
);
