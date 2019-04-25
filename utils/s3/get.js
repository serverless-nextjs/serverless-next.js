const path = require("path");

const cache = {};

const getObjectFromS3Factory = awsProvider =>
  async function getObjectFromS3(key, bucket, nextContinuationToken) {
    if (cache[key]) {
      return cache[key];
    }

    const prefix = path.dirname(key);

    const listParams = {
      Bucket: bucket,
      Prefix: prefix
    };

    if (nextContinuationToken) {
      listParams.ContinuationToken = nextContinuationToken;
    }

    const { Contents, NextContinuationToken, IsTruncated } = await awsProvider(
      "S3",
      "listObjectsV2",
      listParams
    );

    Contents.forEach(entry => {
      cache[entry.Key] = entry;
    });

    if (IsTruncated) {
      await getObjectFromS3(key, bucket, NextContinuationToken);
    }

    return cache[key];
  };

module.exports = awsProvider => (key, bucket) =>
  getObjectFromS3Factory(awsProvider)(key, bucket, null);
