const stream = require("stream");
const walkDir = require("klaw");
const fse = require("fs-extra");
const path = require("path");
const s3Upload = require("../upload");
const getFactory = require("../get");
const logger = require("../../logger");

jest.mock("fs-extra");
jest.mock("klaw");
jest.mock("../get");
jest.mock("../../logger");

describe("s3Upload", () => {
  let upload;
  let walkStream;
  let awsProvider;
  let get;

  beforeEach(() => {
    get = jest.fn();
    awsProvider = jest.fn();
    getFactory.mockReturnValue(get);
    walkStream = new stream.Readable();
    walkStream._read = () => {};
    walkDir.mockReturnValueOnce(walkStream);
    fse.lstat.mockResolvedValue({ isDirectory: () => false });
    fse.createReadStream.mockReturnValue("readStream");

    upload = s3Upload(awsProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should read from the directory given", () => {
    expect.assertions(1);

    const dir = "/path/to/dir";

    const r = upload(dir, { bucket: "my-bucket" }).then(() => {
      expect(walkDir).toBeCalledWith(dir);
    });

    walkStream.emit("end");

    return r;
  });

  it("should upload files to S3 with correct parameters and resolve with file count", () => {
    expect.assertions(5);

    const bucket = "my-bucket";

    const r = upload("/path/to/dir", {
      bucket
    }).then(result => {
      expect(logger.log).toBeCalledWith(
        `Uploading /path/to/dir to ${bucket} ...`
      );

      expect(awsProvider).toBeCalledWith("S3", "upload", {
        ContentType: "application/javascript",
        ACL: "public-read",
        Bucket: bucket,
        Key: "/path/to/foo.js",
        Body: "readStream"
      });

      expect(awsProvider).toBeCalledWith("S3", "upload", {
        ContentType: "text/css",
        ACL: "public-read",
        Bucket: bucket,
        Key: "/path/to/bar.css",
        Body: "readStream"
      });

      expect(awsProvider).toBeCalledWith("S3", "upload", {
        ContentType: "text/plain",
        ACL: "public-read",
        Bucket: bucket,
        Key: "/path/to/readme.txt",
        Body: "readStream"
      });

      expect(result.count).toEqual(3);
    });

    walkStream.emit("data", {
      path: "/path/to/foo.js"
    });

    walkStream.emit("data", {
      path: "/path/to/bar.css"
    });

    walkStream.emit("data", {
      path: "/path/to/readme.txt"
    });

    walkStream.emit("end");

    return r;
  });

  it("should not try uploading directories", () => {
    expect.assertions(1);

    fse.lstat.mockResolvedValue({ isDirectory: () => true });

    const r = upload("/path/to/dir", {
      bucket: "my-bucket"
    }).then(() => {
      expect(awsProvider).not.toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "/path/to/dir/subdir"
        })
      );
    });

    walkStream.emit("data", {
      path: "/path/to/dir/subdir"
    });

    walkStream.emit("end");

    return r;
  });

  it("should handle windows paths", () => {
    expect.assertions(1);

    const r = upload("/path/to/dir", {
      bucket: "my-bucket"
    }).then(() => {
      expect(awsProvider).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "/path/to/foo.js"
        })
      );
    });

    walkStream.emit("data", {
      path: path.win32.normalize("/path/to/foo.js")
    });

    walkStream.emit("end");

    return r;
  });

  it("should reject when a file upload fails", () => {
    expect.assertions(1);

    awsProvider.mockRejectedValueOnce(new Error("Boom!"));

    const promise = upload("/path/to/dir", {
      bucket: "my-bucket"
    }).catch(err => {
      expect(err.message).toContain("Boom");
    });

    walkStream.emit("data", {
      path: "/path/to/foo.js"
    });
    walkStream.emit("end");

    return promise;
  });

  it("S3 Key should use prefix", () => {
    expect.assertions(2);

    const promise = upload("/path/to/dir", {
      bucket: "my-bucket",
      prefix: "to"
    }).then(() => {
      expect(awsProvider).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "to/foo.js"
        })
      );
      expect(awsProvider).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "to/bar.js"
        })
      );
    });

    walkStream.emit("data", {
      path: "/some/path/to/foo.js"
    });

    walkStream.emit("data", {
      path: path.win32.normalize("/some/path/to/bar.js")
    });

    walkStream.emit("end");

    return promise;
  });

  it("S3 Key should use rootPrefix", () => {
    expect.assertions(2);

    const promise = upload("/path/to/dir", {
      bucket: "my-bucket",
      prefix: "/to",
      rootPrefix: "blah"
    }).then(() => {
      expect(awsProvider).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "blah/to/foo.js"
        })
      );
      expect(awsProvider).toBeCalledWith(
        "S3",
        "upload",
        expect.objectContaining({
          Key: "blah/to/bar.js"
        })
      );
    });

    walkStream.emit("data", {
      path: "/some/path/to/foo.js"
    });

    walkStream.emit("data", {
      path: path.win32.normalize("/some/path/to/bar.js")
    });

    walkStream.emit("end");

    return promise;
  });

  it("should not try to upload file that is already uploaded with same file size", () => {
    expect.assertions(2);

    const size = 100;
    const key = "/path/to/happyface.jpg";

    fse.lstat.mockResolvedValueOnce({
      isDirectory: () => false,
      size
    });

    get.mockResolvedValue({
      ETag: '"70ee1738b6b21e2c8a43f3a5ab0eee71"',
      Key: key,
      LastModified: "<Date Representation>",
      Size: size,
      StorageClass: "STANDARD"
    });

    const bucket = "my-bucket";

    const promise = upload("/path/to/dir", {
      bucket
    }).then(() => {
      expect(get).toBeCalledWith(key, bucket);
      expect(awsProvider).not.toBeCalledWith("S3", "upload", expect.anything());
    });

    walkStream.emit("data", {
      path: "/path/to/happyface.jpg"
    });

    walkStream.emit("end");

    return promise;
  });

  it("should upload file that is already uploaded with with different file size", () => {
    expect.assertions(2);

    const size = 100;
    const key = "/path/to/happyface.jpg";

    fse.lstat.mockResolvedValueOnce({
      isDirectory: () => false,
      size
    });

    get.mockResolvedValue({
      ETag: '"70ee1738b6b21e2c8a43f3a5ab0eee71"',
      Key: key,
      LastModified: "<Date Representation>",
      Size: size + 1,
      StorageClass: "STANDARD"
    });

    const bucket = "my-bucket";

    const promise = upload("/path/to/dir", {
      bucket
    }).then(() => {
      expect(get).toBeCalledWith(key, bucket);
      expect(awsProvider).toBeCalledWith("S3", "upload", expect.anything());
    });

    walkStream.emit("data", {
      path: "/path/to/happyface.jpg"
    });

    walkStream.emit("end");

    return promise;
  });
});
