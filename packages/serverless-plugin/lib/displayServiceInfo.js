const chalk = require("chalk");

const outputFinder = outputs => key => {
  return outputs.find(o => o.OutputKey === key);
};

const displayStackOutput = awsInfo => {
  // remove this check after deploy mocks are correctly setup
  if (awsInfo.gatheredData.outputs.length === 0) {
    return;
  }
  const findOutput = outputFinder(awsInfo.gatheredData.outputs);

  const apiGateway = findOutput("ServiceEndpoint");
  const bucketSecureURL = findOutput("NextStaticAssetsS3BucketSecureURL");
  const cloudFrontUrl = findOutput("NextjsCloudFrontURL");

  let message = "";
  message += `\n${chalk.yellow.underline("Nextjs Application Info")}\n\n`;

  if (cloudFrontUrl) {
    message += `${chalk.yellow("Application URL:")} ${
      cloudFrontUrl.OutputValue
    }\n`;
  } else {
    message += `${chalk.yellow("Application URL:")} ${
      apiGateway.OutputValue
    }\n`;
  }

  if (bucketSecureURL) {
    message += `${chalk.yellow("S3 Bucket:")} ${bucketSecureURL.OutputValue}\n`;
  }

  console.log(message);
};

module.exports = displayStackOutput;
