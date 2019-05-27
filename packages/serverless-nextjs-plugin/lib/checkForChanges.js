const getAssetsBucketName = require("./getAssetsBucketName");

module.exports = function() {
  const bucketName = getAssetsBucketName.call(this);
  return this.provider
    .request("S3", "listObjectsV2", {
      Bucket: bucketName,
      MaxKeys: 1
    })
    .catch(err => {
      if (!err.message.includes("The specified bucket does not exist")) {
        throw err;
      }

      throw new Error(
        `The assets bucket "${bucketName}" does not exist. Create it manually or delete the stack and recreate it.`
      );
    });
};
