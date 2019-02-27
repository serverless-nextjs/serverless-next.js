const fs = require("fs");
const walkDir = require("klaw");
const mime = require("mime");
const uploadStaticAssetsToS3 = require("../uploadStaticAssetsToS3");
const logger = require("../../utils/logger");

jest.mock("../../utils/logger");
jest.mock("fs");
jest.mock("mime");
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log when upload started", () => {
    expect.assertions(1);
    const bucketName = "my-bucket";

    return uploadStaticAssetsToS3({
      staticAssetsPath: ".next/static",
      bucketName,
      providerRequest: () => {}
    }).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Uploading static assets to ${bucketName}`)
      );
    });
  });

  it("should log when upload finished", () => {
    expect.assertions(1);

    return uploadStaticAssetsToS3({
      staticAssetsPath: ".next/static",
      providerRequest: () => {}
    }).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Upload finished`)
      );
    });
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

  it("should upload to S3 the next static assets with correct body", () => {
    expect.assertions(2);

    fs.createReadStream.mockReturnValueOnce("FakeStream");
    walkDir.mockImplementationOnce(() => walkDirStreamMock);

    const providerRequest = jest.fn();
    const bucketName = "my-bucket";

    mime.getType.mockImplementation(() => "application/foo");

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest,
      bucketName
    }).then(() => {
      expect(mime.getType).toBeCalledWith(
        expect.stringContaining("chunks/foo.js")
      );
      expect(providerRequest).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          ACL: "public-read",
          Bucket: bucketName,
          Key: "_next/static/chunks/foo.js",
          ContentType: "application/foo"
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

  it("should resolve when all files have been uploaded and return files count", () => {
    expect.assertions(1);

    const walkDirStreamMock = {
      on: (event, cb) => {
        if (event === "data") {
          cb({ path: "/users/foo/prj/.next/static/chunks/1.js" });
          cb({ path: "/users/foo/prj/.next/static/chunks/2.js" });
        } else if (event === "end") {
          cb();
        }

        return walkDirStreamMock;
      }
    };

    walkDir.mockImplementation(() => walkDirStreamMock);

    const providerRequest = jest.fn().mockResolvedValue("OK");

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest
    }).then(filesUploaded => {
      expect(filesUploaded).toEqual(2);
    });
  });

  it("should reject when a file upload fails", () => {
    expect.assertions(1);

    const walkDirStreamMock = {
      on: (event, cb) => {
        if (event === "data") {
          cb({ path: "/users/foo/prj/.next/static/chunks/1.js" });
          cb({ path: "/users/foo/prj/.next/static/chunks/2.js" });
        } else if (event === "end") {
          cb();
        }

        return walkDirStreamMock;
      }
    };

    walkDir.mockImplementation(() => walkDirStreamMock);

    const providerRequest = jest.fn().mockRejectedValueOnce("Error");

    return uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest
    }).catch(err => {
      expect(err.message).toContain("File upload failed");
    });
  });
});
