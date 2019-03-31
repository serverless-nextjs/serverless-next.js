const path = require('path');
const fs = require("fs");
const walkDir = require("klaw");
const mime = require("mime");
const stream = require("stream");
const uploadStaticAssetsToS3 = require("../uploadStaticAssetsToS3");
const logger = require("../../utils/logger");

jest.mock("../../utils/logger");
jest.mock("fs");
jest.mock("mime");
jest.mock("klaw");

describe("uploadStaticAssetsToS3", () => {
  let mockedStream;

  beforeEach(() => {
    mockedStream = new stream.Readable();
    mockedStream._read = () => {};
    walkDir.mockReturnValueOnce(mockedStream);
    fs.lstatSync.mockReturnValue({ isDirectory: () => false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log when upload started", () => {
    expect.assertions(1);
    const bucketName = "my-bucket";

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join(".next", "static"),
      bucketName,
      providerRequest: () => {}
    }).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Uploading static assets to ${bucketName}`)
      );
    });

    mockedStream.emit("data", {
      path: path.normalize("users/foo/static/chunks/foo.js")      
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should log when upload finished", () => {
    expect.assertions(1);

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join(".next", "static"),
      providerRequest: () => {}
    }).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Upload finished`)
      );
    });

    mockedStream.emit("data", {
      path: path.normalize("users/foo/static/chunks/foo.js")      
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should get a list of all static files to upload", () => {
    expect.assertions(1);

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join(".next", "static"),
      providerRequest: () => {}
    }).then(() => {
      expect(walkDir).toBeCalledWith(path.join(".next", "static"));
    });

    mockedStream.emit("data", {
      path: path.normalize("users/foo/static/chunks/foo.js")      
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should get a list of all static files to upload using the custom next build dir provided", () => {
    expect.assertions(1);

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join("build", "static"),      
      providerRequest: () => {}
    }).then(() => {
      expect(walkDir).toBeCalledWith(path.join("build", "static"));
    });

    mockedStream.emit("data", {
      path: path.normalize("users/foo/static/chunks/foo.js")      
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should upload to S3 the next static assets with correct body", () => {
    expect.assertions(2);

    fs.createReadStream.mockReturnValueOnce("FakeStream");

    const providerRequest = jest.fn();
    const bucketName = "my-bucket";

    mime.getType.mockImplementation(() => "application/foo");

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join('build', 'static'),
      providerRequest,
      bucketName
    }).then(() => {
      expect(mime.getType).toBeCalledWith(
        expect.stringContaining(path.normalize("chunks/foo.js"))
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

    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks/foo.js")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should not try to upload directories to S3 bucket", () => {
    expect.assertions(1);

    fs.lstatSync.mockReturnValue({ isDirectory: () => true });

    const providerRequest = jest.fn();

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join("build", "static"),
      providerRequest
    }).then(() => {
      expect(providerRequest).not.toBeCalled();
    });

    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should resolve when all files have been uploaded and return files count", () => {
    expect.assertions(1);

    const providerRequest = jest.fn().mockResolvedValue("OK");

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: "build/static",
      providerRequest
    }).then(filesUploaded => {
      expect(filesUploaded).toEqual(2);
    });

    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks/1.js")
    });
    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks/2.js")
    });
    mockedStream.emit("end");

    return promise;
  });

  it("should reject when a file upload fails", () => {
    expect.assertions(1);

    const providerRequest = jest.fn().mockRejectedValueOnce("Error");

    const promise = uploadStaticAssetsToS3({
      staticAssetsPath: path.join("build", "static"),
      providerRequest
    }).catch(err => {
      expect(err.message).toContain("File upload failed");
    });

    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks/1.js")
    });
    mockedStream.emit("data", {
      path: path.normalize("/users/foo/prj/.next/static/chunks/2.js")
    });
    mockedStream.emit("end");

    return promise;
  });
});
