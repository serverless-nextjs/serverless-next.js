const nextLoadConfig = require("next-server/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next-server/dist/lib/constants");
const parseNextConfiguration = require("../parseNextConfiguration");

jest.mock("next-server/dist/server/config");

describe("parseNextConfiguration", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if no nextConfigDir is given", () => {
    expect(() => parseNextConfiguration()).toThrow(
      "Provide a valid next.config"
    );
  });

  it("should call nextLoadConfig with config dir given", () => {
    const configDir = "/path/to/next";
    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: "https://s3.amazonaws.com/my-bucket"
    });

    parseNextConfiguration(configDir);

    expect(nextLoadConfig).toBeCalledWith(PHASE_PRODUCTION_BUILD, configDir);
  });

  it("should throw if no assetPrefix is configured", () => {
    nextLoadConfig.mockReturnValueOnce({
      target: "serverless"
    });
    expect(() => parseNextConfiguration("/path/to/next")).toThrow(
      "No assetPrefix configured"
    );
  });

  it("should throw if it can't parse bucket name from assetPrefix when URL is completely invalid", () => {
    expect.assertions(1);

    const bucketUrl = "https://someurl.co.uk/foo";

    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: bucketUrl
    });

    expect(() => parseNextConfiguration("/path/to/next")).toThrow(
      `Could not parse bucket from assetPrefix: ${bucketUrl}`
    );
  });

  it("should throw if it can't parse bucket name from assetPrefix when URL is partially valid", () => {
    const bucketUrl = "https://s3.amazonaws.com/";

    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: bucketUrl
    });

    expect(() => parseNextConfiguration("/path/to/next")).toThrow(
      `Could not parse bucket from assetPrefix: ${bucketUrl}`
    );
  });

  it("should return bucket name parsed from next config", () => {
    const configDir = "/path/to/next";
    const bucketName = "my-bucket";
    const nextConfig = {
      target: "serverless",
      assetPrefix: `https://s3.amazonaws.com/${bucketName}`
    };
    nextLoadConfig.mockReturnValueOnce(nextConfig);

    const config = parseNextConfiguration(configDir);

    expect(config.staticAssetsBucket).toEqual(bucketName);
  });

  it("should return next configuration object", () => {
    const configDir = "/path/to/next";
    const bucketName = "my-bucket";
    const distDir = "build";
    const nextConfig = {
      target: "serverless",
      distDir,
      assetPrefix: `https://s3.amazonaws.com/${bucketName}`
    };
    nextLoadConfig.mockReturnValueOnce(nextConfig);

    const config = parseNextConfiguration(configDir);

    expect(config.nextConfiguration).toEqual(nextConfig);
  });
});
