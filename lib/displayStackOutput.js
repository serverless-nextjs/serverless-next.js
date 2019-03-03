const logger = require("../utils/logger");

const displayStackOutput = awsInfo => {
  const outputs = awsInfo.gatheredData.outputs;
  const [
    staticAssetsBucketSecureURL,
    staticAssetsBucketWebsiteURL
  ] = outputs.filter(output => {
    return (
      output.OutputKey === "NextStaticAssetsS3BucketSecureURL" ||
      output.OutputKey === "NextStaticAssetsS3BucketWebsiteURL"
    );
  });

  logger.log(
    `assets bucket secure URL: ${staticAssetsBucketSecureURL.OutputValue}`
  );
  logger.log(
    `assets bucket website URL: ${staticAssetsBucketWebsiteURL.OutputValue}`
  );
};

module.exports = displayStackOutput;
