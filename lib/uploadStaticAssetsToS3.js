const fs = require("fs");
const path = require("path");
const walkDir = require("klaw");

const uploadStaticAssetsToS3 = ({
  staticAssetsPath,
  bucketName,
  providerRequest
}) => {
  return new Promise(resolve => {
    walkDir(staticAssetsPath)
      .on("data", item => {
        const itemPath = item.path;
        const isFile = !fs.lstatSync(itemPath).isDirectory();

        if (isFile) {
          providerRequest("S3", "upload", {
            ACL: "public-read",
            Bucket: bucketName,
            Key: path.join(
              "_next",
              itemPath.substring(itemPath.indexOf("/static"), itemPath.length)
            ),
            Body: fs.createReadStream(itemPath)
          });
        }
      })
      .on("end", () => {
        resolve({});
      });
  });
};

module.exports = uploadStaticAssetsToS3;
