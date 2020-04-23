const parsedNextConfigurationFactory = (
  nextConfiguration = {
    distDir: ".next",
    target: "serverless"
  },
  staticAssetsBucket = "my-bucket"
) => ({
  staticAssetsBucket,
  nextConfiguration
});

module.exports = parsedNextConfigurationFactory;
