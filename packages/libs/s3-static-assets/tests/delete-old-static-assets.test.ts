import { deleteOldStaticAssets } from "../src/index";
import AWS, {
  mockGetObject,
  mockGetObjectPromise,
  mockListObjectsV2,
  mockDeleteObjects
} from "aws-sdk";

// unfortunately can't use __mocks__ because aws-sdk is being mocked in other
// packages in the monorepo
// https://github.com/facebook/jest/issues/2070
jest.mock("aws-sdk", () => require("./aws-sdk.mock"));

const deleteOldAssets = (basePath?: string): Promise<void> => {
  return deleteOldStaticAssets({
    bucketName: "test-bucket-name",
    bucketRegion: "us-east-1",
    basePath: basePath || "",
    credentials: {
      accessKeyId: "fake-access-key",
      secretAccessKey: "fake-secret-key",
      sessionToken: "fake-session-token"
    }
  });
};

describe.each`
  basePath
  ${""}
  ${"/basepath"}
`(
  "Delete old static assets tests for basePath: [$basePath]",
  ({ basePath }) => {
    let consoleWarnSpy: jest.SpyInstance;
    const basePathPrefix = basePath === "" ? "" : basePath.slice(1) + "/";

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockReturnValue();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("does not delete static assets when no BUILD_ID exists", async () => {
      mockGetObjectPromise.mockRejectedValue({
        code: "NoSuchKey"
      });

      await deleteOldAssets(basePath);

      expect(mockGetObject).toBeCalledTimes(1);
      expect(mockGetObject).toBeCalledWith({
        Bucket: "test-bucket-name",
        Key: basePathPrefix + "BUILD_ID"
      });

      expect(mockListObjectsV2).toBeCalledTimes(0);
      expect(mockDeleteObjects).toBeCalledTimes(0);
    });

    it("does not delete static assets when BUILD_ID exists but listed objects are empty", async () => {
      mockGetObjectPromise.mockResolvedValue({
        Body: "test-build-id"
      });

      mockListObjectsV2.mockImplementation(() => {
        return { promise: () => Promise.resolve({ Contents: [] }) };
      });

      await deleteOldAssets(basePath);

      expect(mockListObjectsV2).toBeCalledTimes(2);
      expect(mockDeleteObjects).toBeCalledTimes(0);
    });

    it("deletes static assets when BUILD_ID exists", async () => {
      mockGetObjectPromise.mockResolvedValue({
        Body: "test-build-id"
      });

      mockListObjectsV2.mockImplementation((object) => {
        if (object.Prefix === basePathPrefix + "static-pages") {
          return {
            promise: () =>
              Promise.resolve({
                Contents: [
                  {
                    Key: basePathPrefix + "static-pages/prev-build-id/page.html"
                  },
                  {
                    Key: basePathPrefix + "static-pages/test-build-id/page.html"
                  },
                  { Key: basePathPrefix + "static-pages/page.html" } // Backwards compatibility, never delete existing pages in root
                ]
              })
          };
        } else if (object.Prefix === basePathPrefix + "_next/data") {
          return {
            promise: () =>
              Promise.resolve({
                Contents: [
                  {
                    Key: basePathPrefix + "_next/data/prev-build-id/page.json"
                  },
                  { Key: basePathPrefix + "_next/data/test-build-id/page.json" }
                ]
              })
          };
        }
      });

      await deleteOldAssets(basePath);

      expect(AWS.S3).toBeCalledWith({
        accessKeyId: "fake-access-key",
        endpoint: "https://s3.us-east-1.amazonaws.com",
        s3BucketEndpoint: false,
        secretAccessKey: "fake-secret-key",
        sessionToken: "fake-session-token",
        region: "us-east-1"
      });

      expect(mockDeleteObjects).toBeCalledTimes(2);

      expect(mockListObjectsV2).toBeCalledWith({
        Bucket: "test-bucket-name",
        Prefix: basePathPrefix + "static-pages",
        ContinuationToken: undefined
      });

      expect(mockListObjectsV2).toBeCalledWith({
        Bucket: "test-bucket-name",
        Prefix: basePathPrefix + "_next/data",
        ContinuationToken: undefined
      });

      expect(mockDeleteObjects).toBeCalledTimes(2);

      // Expect only prev-build-id is deleted, not test-build-id which is in BUILD_ID (current build ID in S3)

      expect(mockDeleteObjects).toBeCalledWith({
        Bucket: "test-bucket-name",
        Delete: {
          Objects: [
            { Key: basePathPrefix + "static-pages/prev-build-id/page.html" }
          ]
        }
      });

      expect(mockDeleteObjects).toBeCalledWith({
        Bucket: "test-bucket-name",
        Delete: {
          Objects: [
            { Key: basePathPrefix + "_next/data/prev-build-id/page.json" }
          ]
        }
      });
    });
  }
);
