import stream from "stream";
import fse from "fs-extra";
import path from "path";
import uploadStaticAssets from "../index";
import { mockUpload } from "aws-sdk";

declare module "aws-sdk" {
  const mockUpload: jest.Mock;
}

describe("Upload assets tests", () => {
  it("uploads any contents inside build directory specified in BUILD_ID", async () => {
    await uploadStaticAssets({
      bucketName: "test-bucket-name",
      nextAppDir: path.join(__dirname, "./fixtures/basic-next-app")
    });

    const mockedBodyStream = new stream.Readable();
    jest
      .spyOn(fse, "readFile")
      .mockResolvedValue(Promise.resolve(mockedBodyStream));

    const expectedCacheControl = "public, max-age=31536000, immutable";

    expect(mockUpload).toBeCalledWith({
      Bucket: "test-bucket-name",
      Key: "_next/static/a_test_build_id/testFileOne.js",
      Body: mockedBodyStream,
      ContentType: "application/javascript",
      CacheControl: expectedCacheControl
    });

    expect(mockUpload).toBeCalledWith({
      Bucket: "test-bucket-name",
      Key: "_next/static/a_test_build_id/subdir/testFileTwo.js",
      Body: mockedBodyStream,
      ContentType: "application/javascript",
      CacheControl: expectedCacheControl
    });
  });
});
