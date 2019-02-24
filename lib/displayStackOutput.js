const chalk = require("chalk");

const displayStackOutput = ({ awsInfo, consoleLog }) => {
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

  consoleLog(chalk.yellow("Nextjs static assets bucket details:"));

  consoleLog(
    `${chalk.yellow("Bucket secure URL:")} ${
      staticAssetsBucketSecureURL.OutputValue
    }`
  );

  consoleLog(
    `${chalk.yellow("Bucket website URL:")} ${
      staticAssetsBucketWebsiteURL.OutputValue
    }`
  );
};

module.exports = displayStackOutput;
