import path from "path";
import uploadStaticAssets from "../src/index";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "../src/constants";
import { mockUpload } from "aws-sdk";

declare module "aws-sdk" {
  const mockUpload: jest.Mock;
}

describe("Upload assets tests", () => {
  beforeEach(async () => {
    await uploadStaticAssets({
      bucketName: "test-bucket-name",
      nextAppDir: path.join(__dirname, "./fixtures/basic-next-app")
    });
  });

  it("uploads any contents inside build directory specified in BUILD_ID", async () => {
    expect(mockUpload).toBeCalledTimes(2);

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
    expect(mockUpload).toBeCalledWith({
      Key: "static-pages/todos/terms.html",
      ContentType: "text/html",
      CacheControl: undefined
    });

    expect(mockUpload).toBeCalledWith({
      Key: "static-pages/todos/terms/[section].html",
      Body: expect.any(Buffer),
      ContentType: "text/html",
      CacheControl: undefined
    });
  });
});
