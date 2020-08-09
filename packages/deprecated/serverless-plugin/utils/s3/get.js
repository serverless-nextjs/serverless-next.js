const path = require("path");
const debug = require("debug")("sls-next:s3");

module.exports = (awsProvider) => {
  const cache = {};

  const addPrefixToCache = (prefix, listPromise) => {
    const updateCache = (prefixCache) =>
      listPromise.then(({ Contents }) => {
        Contents.forEach((x) => (prefixCache[x.Key] = x));
        return prefixCache;
      });

    if (cache[prefix]) {
      // already objects have been cached for this prefix
      cache[prefix] = cache[prefix].then((prefixCache) =>
        updateCache(prefixCache)
      );
    } else {
      cache[prefix] = updateCache({});
    }
  };

  return (key, bucket) => {
    async function getWithCache(nextContinuationToken) {
      const prefix = path.dirname(key);

      const shouldReturnFromCache = cache[prefix] && !nextContinuationToken;

      if (shouldReturnFromCache) {
        debug(`cache hit - ${key}`);
        const objects = await cache[prefix];
        return objects[key];
      }

      const listParams = {
        Bucket: bucket,
        Prefix: prefix
      };

      if (nextContinuationToken) {
        listParams.ContinuationToken = nextContinuationToken;
      }

      debug(`listObjects - ${listParams.Prefix}`);

      const listPromise = awsProvider("S3", "listObjectsV2", listParams);

      addPrefixToCache(prefix, listPromise);

      const { NextContinuationToken, IsTruncated } = await listPromise;

      if (IsTruncated) {
        await getWithCache(NextContinuationToken);
      }

      const keys = await cache[prefix];
      return keys[key];
    }

    const object = getWithCache(null);

    return object;
  };
};
