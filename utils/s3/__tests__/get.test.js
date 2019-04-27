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

  it("should list objects using bucket and prefix", () => {
    expect.assertions(2);

    const key = "/path/to/smile.jpg";
    const bucket = "my-bucket";

    awsProvider.mockResolvedValueOnce({
      Contents: [
        {
          Key: key
        }
      ]
    });

    return get(key, bucket).then(object => {
      expect(object.Key).toEqual(key);
      expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
        Bucket: bucket,
        Prefix: "/path/to"
      });
    });
  });

  it("should not list objects again if key already in cache", () => {
    expect.assertions(3);

    const key = "/path/to/ironman.jpg";
    const bucket = "my-bucket";

    awsProvider.mockResolvedValueOnce({
      Contents: [
        {
          Key: key
        }
      ]
    });

    return get(key, bucket)
      .then(() => get(key, bucket))
      .then(object => {
        expect(object.Key).toEqual(key);
        expect(awsProvider).toBeCalledTimes(1);
        expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
          Bucket: bucket,
          Prefix: "/path/to"
        });
      });
  });

  it("should handle paginated response", () => {
    expect.assertions(4);

    const key = "/path/to/batman.jpg";
    const bucket = "my-bucket";
    const continuationToken = "123";

    awsProvider.mockResolvedValueOnce({
      IsTruncated: true,
      Contents: [{ Key: "/path/to/bar.jpg" }],
      NextContinuationToken: continuationToken
    });

    return get(key, bucket).then(object => {
      expect(object).toEqual(undefined);
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

  it("should not list objects again if key already in cache after paginated response", () => {
    expect.assertions(4);

    const bucket = "my-bucket";
    const key = "/path/to/ironman.jpg";

    awsProvider.mockResolvedValueOnce({
      IsTruncated: true,
      Contents: [{ Key: key }],
      NextContinuationToken: "123"
    });

    return get(key, bucket)
      .then(() => get(key, bucket))
      .then(object => {
        expect(object.Key).toEqual(key);
        expect(awsProvider).toBeCalledTimes(2);
        expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
          Bucket: bucket,
          Prefix: "/path/to"
        });
        expect(awsProvider).toBeCalledWith("S3", "listObjectsV2", {
          Bucket: bucket,
          Prefix: "/path/to",
          ContinuationToken: "123"
        });
      });
  });
});
