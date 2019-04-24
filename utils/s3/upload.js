const mime = require("mime");
const walkDir = require("klaw");
const fse = require("fs-extra");
const path = require("path");
const pathToPosix = require("../pathToPosix");
const get = require("./get");

const getUploadParameters = (bucket, filePath, prefix, rootPrefix) => {
  let key = pathToPosix(filePath);

  if (prefix) {
    key = key.substring(key.indexOf(prefix), key.length);
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

module.exports = awsProvider => (
  dir,
  { bucket, prefix = null, rootPrefix = null }
) => {
  const getObjectFromS3 = get(awsProvider);
  const promises = [];

  return new Promise((resolve, reject) => {
    walkDir(dir)
      .on("data", item => {
        const p = fse.lstat(item.path).then(async stats => {
          if (!stats.isDirectory()) {
            const uploadParams = getUploadParameters(
              bucket,
              item.path,
              prefix,
              rootPrefix
            );

            const s3Object = await getObjectFromS3(uploadParams.Key, bucket);

            if (s3Object && stats.size === s3Object.Size) {
              // no need to upload, already on S3 and has same size
              return Promise.resolve();
            }

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
