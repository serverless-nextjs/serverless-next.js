const mime = require("mime");
const walkDir = require("klaw");
const fse = require("fs-extra");
const path = require("path");
const pathToPosix = require("../pathToPosix");
const get = require("./get");
const logger = require("../logger");
const debug = require("debug")("sls-next:s3");

const getUploadParameters = (bucket, filePath, truncate, rootPrefix) => {
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
    ContentType: mime.getType(key),
    Body: fse.createReadStream(filePath)
  };
};

const filesAreEqual = (s3Object, fStats) =>
  s3Object && fStats.size === s3Object.Size;

module.exports = awsProvider => (
  dir,
  { bucket, truncate = null, rootPrefix = null }
) => {
  const getObjectFromS3 = get(awsProvider);
  const promises = [];

  logger.log(`Uploading ${dir} to ${bucket} ...`);

  return new Promise((resolve, reject) => {
    walkDir(dir)
      .on("data", item => {
        const p = fse.lstat(item.path).then(async stats => {
          if (!stats.isDirectory()) {
            const uploadParams = getUploadParameters(
              bucket,
              item.path,
              truncate,
              rootPrefix
            );

            const s3Object = await getObjectFromS3(uploadParams.Key, bucket);

            if (filesAreEqual(s3Object, stats)) {
              debug(`no need to upload ${uploadParams.Key}`);
              return Promise.resolve();
            }

            debug(`uploading to s3 - ${uploadParams.Key}`);
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
