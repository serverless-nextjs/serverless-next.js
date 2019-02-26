const fs = require("fs");
const path = require("path");
const walkDir = require("klaw");
const chalk = require("chalk");
const mime = require("mime");

const uploadStaticAssetsToS3 = ({
  staticAssetsPath,
  consoleLog,
  bucketName,
  providerRequest
}) => {
  return new Promise((resolve, reject) => {
    const uploadPromises = [];

    consoleLog(
      chalk.yellow(
        `Serverless Nextjs: Uploading static assets to ${bucketName} ...`
      )
    );

    walkDir(staticAssetsPath)
      .on("data", item => {
        const itemPath = item.path;
        const isFile = !fs.lstatSync(itemPath).isDirectory();

        if (isFile) {
          uploadPromises.push(
            providerRequest("S3", "upload", {
              ACL: "public-read",
              Bucket: bucketName,
              Key: path.join(
                "_next",
                itemPath.substring(itemPath.indexOf("/static"), itemPath.length)
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
            consoleLog(chalk.yellow("Serverless Nextjs: Upload finished"));
            resolve(results.length);
          })
          .catch(() => {
            reject(new Error("File upload failed"));
          });
      });
  });
};

module.exports = uploadStaticAssetsToS3;
