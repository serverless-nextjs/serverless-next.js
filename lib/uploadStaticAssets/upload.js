const fs = require("fs");
const path = require("path");
const walkDir = require("klaw");
const mime = require("mime");
const logger = require("../../utils/logger");
const toPosix = require("../../utils/pathToPosix");

const uploadDir = (dir, bucketName, providerRequest) => {
  const uploadPromises = [];

  return new Promise((resolve, reject) => {
    walkDir(dir)
      .on("data", item => {
        const itemPath = item.path;
        const isFile = !fs.lstatSync(itemPath).isDirectory();
        const posixItemPath = toPosix(item.path);

        if (isFile) {
          uploadPromises.push(
            providerRequest("S3", "upload", {
              ACL: "public-read",
              Bucket: bucketName,
              Key: path.posix.join(
                "_next",
                posixItemPath.substring(
                  posixItemPath.indexOf("/static"),
                  posixItemPath.length
                )
              ),
              ContentType: mime.getType(itemPath),
              Body: fs.createReadStream(itemPath)
            })
          );
        }
      })
      .on("end", () => {
        Promise.all(uploadPromises)
          .then(results => {
            logger.log("Upload finished");
            resolve(results.length);
          })
          .catch(() => {
            reject(new Error("File upload failed"));
          });
      });
  });
};

const uploadStaticAssetsToS3 = ({
  buildAssetsDir,
  bucketName,
  providerRequest
}) => {
  logger.log(`Uploading static assets to ${bucketName} ...`);
  return uploadDir(buildAssetsDir, bucketName, providerRequest);
};

module.exports = uploadStaticAssetsToS3;
