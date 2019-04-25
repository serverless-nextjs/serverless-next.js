const getFactory = require("../get");

describe("s3 get", () => {
  let awsProvider;
  let get;

  beforeEach(() => {
    awsProvider = jest.fn().mockResolvedValue({
      Contents: []
    });
    get = getFactory(awsProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call listObjects with bucket and prefix", () => {
    expect.assertions(1);

    const bucket = "my-bucket";

    return get("/path/to/smile.jpg", bucket).then(() => {
      expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
        Bucket: bucket,
        Prefix: "/path/to"
      });
    });
  });

  it("should not listObjects if key already in cache", () => {
    expect.assertions(2);

    const bucket = "my-bucket";
    const key = "/path/to/ironman.jpg";

    awsProvider.mockResolvedValueOnce({
      Contents: [
        {
          Key: key
        }
      ]
    });

    return get(key, bucket)
      .then(() => get(key, bucket))
      .then(() => {
        expect(awsProvider).toBeCalledTimes(1);
        expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
          Bucket: bucket,
          Prefix: "/path/to"
        });
      });
  });

  it("should handle paginated response", () => {
    expect.assertions(3);

    const key = "/path/to/batman.jpg";
    const bucket = "my-bucket";
    const continuationToken = "123";

    awsProvider.mockResolvedValueOnce({
      IsTruncated: true,
      Contents: [{ Key: "/path/to/bar.jpg" }],
      NextContinuationToken: continuationToken
    });

    return get(key, bucket).then(() => {
      expect(awsProvider).toBeCalledTimes(2);
      expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
        Bucket: bucket,
        Prefix: "/path/to"
      });
      expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
        Bucket: bucket,
        Prefix: "/path/to",
        ContinuationToken: continuationToken
      });
    });
  });
});
