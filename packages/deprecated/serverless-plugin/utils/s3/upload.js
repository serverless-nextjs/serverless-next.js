const mime = require("mime");
const walkDir = require("klaw");
const fse = require("fs-extra");
const path = require("path");
const pathToPosix = require("../pathToPosix");
const get = require("./get");
const logger = require("../logger");
const debug = require("debug")("sls-next:s3");

const getUploadParameters = (
  bucket,
  filePath,
  truncate,
  rootPrefix,
  CacheControl
) => {
  let key = pathToPosix(filePath);

  if (truncate) {
    const pathSegments = key.split(path.posix.sep);
    const prefixIndex = pathSegments.indexOf(truncate);

    if (prefixIndex !== -1) {
      key = pathSegments
        .slice(prefixIndex, pathSegments.length)
        .join(path.posix.sep);
    }
  }

  if (rootPrefix) {
    key = path.posix.join(rootPrefix, key);
  }

  return {
    ACL: "public-read",
    Bucket: bucket,
    Key: key,
    CacheControl,
    ContentType: mime.getType(key),
    Body: fse.createReadStream(filePath)
  };
};

const filesAreEqual = (s3Object, fStats) =>
  s3Object && fStats.size === s3Object.Size;

const cacheHeaderFactory = (buildId = "", rootPrefix) => {
  // Check the paht for the following:
  // (1) chunk/* (2) build_id/* and (3) runtime/*
  // and return cache control header if true
  const buildIdRegex = buildId.length ? `|${buildId}` : "";
  const useCacheControlHeaderRegex = new RegExp(
    `.*(?:chunk|runtime${buildIdRegex})`
  );

  return (item) => {
    let CacheControl = undefined;
    if (
      rootPrefix === "_next" &&
      useCacheControlHeaderRegex.test(path.dirname(item.path))
    ) {
      CacheControl = "public, max-age=31536000, immutable";
    }

    return CacheControl;
  };
};

module.exports =
  (awsProvider, buildId) =>
  (dir, { bucket, truncate = null, rootPrefix = null }) => {
    const getCacheHeader = cacheHeaderFactory(buildId, rootPrefix);
    const getObjectFromS3 = get(awsProvider);
    const promises = [];

    logger.log(`Uploading ${dir} to ${bucket} ...`);

    return new Promise((resolve, reject) => {
      walkDir(dir)
        .on("data", (item) => {
          const p = fse.lstat(item.path).then(async (stats) => {
            if (!stats.isDirectory()) {
              const CacheControl = getCacheHeader(item);
              const uploadParams = getUploadParameters(
                bucket,
                item.path,
                truncate,
                rootPrefix,
                CacheControl
              );

              const s3Object = await getObjectFromS3(uploadParams.Key, bucket);

              if (filesAreEqual(s3Object, stats)) {
                debug(`no need to upload ${uploadParams.Key}`);
                return Promise.resolve();
              }

              debug(
                `uploading to s3 - ${uploadParams.Key} ${
                  CacheControl ? " with cachecontrol " + CacheControl : ""
                }`
              );

              return awsProvider("S3", "upload", uploadParams);
            }
          });

          promises.push(p);
        })
        .on("end", () => {
          Promise.all(promises)
            .then(() => {
              resolve({ count: promises.length });
            })
            .catch(reject);
        });
    });
  };
