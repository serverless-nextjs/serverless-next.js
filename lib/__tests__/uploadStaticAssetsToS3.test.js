const fs = require("fs");
const walkDir = require("klaw");
const uploadStaticAssetsToS3 = require("../uploadStaticAssetsToS3");

jest.mock("fs");
jest.mock("klaw");

describe("uploadStaticAssetsToS3", () => {
  let walkDirStreamMock;

  beforeEach(() => {
    walkDirStreamMock = {
      on: (event, cb) => {
        if (event === "data") {
          cb({ path: "/users/foo/prj/.next/static/chunks/foo.js" });
        } else if (event === "end") {
          cb();
        }

        return walkDirStreamMock;
      }
    };

    fs.lstatSync.mockReturnValue({ isDirectory: () => false });
    walkDir.mockImplementation(() => walkDirStreamMock);
  });

  it("should get a list of all static files to upload", () => {
    expect.assertions(1);

    return uploadStaticAssetsToS3({
      staticAssetsPath: ".next/static",
      providerRequest: () => {}
    }).then(() => {
      expect(walkDir).toBeCalledWith(".next/static");
    });
  });

  it("should get a list of all static files to upload using the custom next build dir provided", () => {
    expect.assertions(1);

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest: () => {}
    }).then(() => {
      expect(walkDir).toBeCalledWith("build/static");
    });
  });

  it("should upload to S3 the next static assets", () => {
    expect.assertions(1);

    fs.createReadStream.mockReturnValueOnce("FakeStream");
    walkDir.mockImplementationOnce(() => walkDirStreamMock);

    const providerRequest = jest.fn();
    const bucketName = "my-bucket";

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest,
      bucketName
    }).then(() => {
      expect(providerRequest).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Bucket: bucketName
        })
      );
    });
  });

  it("should not try to upload directories to S3 bucket", () => {
    expect.assertions(1);

    const walkDirStreamMock = {
      on: (event, cb) => {
        if (event === "data") {
          cb({ path: "/users/foo/prj/.next/static/chunks" });
        } else if (event === "end") {
          cb();
        }

        return walkDirStreamMock;
      }
    };

    walkDir.mockClear();
    fs.lstatSync.mockReturnValue({ isDirectory: () => true });
    walkDir.mockImplementation(() => walkDirStreamMock);

    const providerRequest = jest.fn();

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest
    }).then(() => {
      expect(providerRequest).not.toBeCalled();
    });
  });
});
