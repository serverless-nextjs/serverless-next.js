const nextLoadConfig = require("next-server/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next-server/dist/lib/constants");
const parseNextConfiguration = require("../parseNextConfiguration");

jest.mock("next-server/dist/server/config");

describe("parseNextConfiguration", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if no nextConfigDir is given", () => {
    expect.assertions(1);

    return parseNextConfiguration().catch(err => {
      expect(err.message).toContain("Provide a valid next.config");
    });
  });

  it("should call nextLoadConfig with config dir given", () => {
    expect.assertions(1);
    const configDir = "/path/to/next";
    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: "https://s3.amazonaws.com/my-bucket"
    });

    return parseNextConfiguration(configDir).then(() => {
      expect(nextLoadConfig).toBeCalledWith(PHASE_PRODUCTION_BUILD, configDir);
    });
  });

  it("should throw if target is not 'serverless'", () => {
    expect.assertions(1);
    nextLoadConfig.mockReturnValueOnce({ target: "foo" });

    return parseNextConfiguration("/path/to/next").catch(err => {
      expect(err.message).toContain("Target 'foo' is invalid");
    });
  });

  it("should throw if no assetPrefix is configured", () => {
    expect.assertions(1);

    nextLoadConfig.mockReturnValueOnce({
      target: "serverless"
    });

    return parseNextConfiguration("/path/to/next").catch(err => {
      expect(err.message).toContain("No assetPrefix configured");
    });
  });

  it("should throw if it can't parse bucket name from assetPrefix when URL is completely invalid", () => {
    expect.assertions(1);

    const bucketUrl = "https://someurl.co.uk/foo";

    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: bucketUrl
    });

    return parseNextConfiguration("/path/to/next").catch(err => {
      expect(err.message).toContain(
        `Could not parse bucket from assetPrefix: ${bucketUrl}`
      );
    });
  });

  it("should throw if it can't parse bucket name from assetPrefix when URL is partially valid", () => {
    expect.assertions(1);

    const bucketUrl = "https://s3.amazonaws.com/";

    nextLoadConfig.mockReturnValueOnce({
      target: "serverless",
      assetPrefix: bucketUrl
    });

    return parseNextConfiguration("/path/to/next").catch(err => {
      expect(err.message).toContain(
        `Could not parse bucket from assetPrefix: ${bucketUrl}`
      );
    });
  });

  it("should return bucket name parsed from next config", () => {
    expect.assertions(1);

    const configDir = "/path/to/next";
    const bucketName = "my-bucket";
    const nextConfig = {
      target: "serverless",
      assetPrefix: `https://s3.amazonaws.com/${bucketName}`
    };
    nextLoadConfig.mockReturnValueOnce(nextConfig);

    return parseNextConfiguration(configDir).then(config => {
      expect(config).toEqual(
        expect.objectContaining({
          staticAssetsBucket: bucketName
        })
      );
    });
  });

  it("should return build directory from next config", () => {
    expect.assertions(1);

    const configDir = "/path/to/next";
    const bucketName = "my-bucket";
    const distDir = "build";
    const nextConfig = {
      target: "serverless",
      distDir,
      assetPrefix: `https://s3.amazonaws.com/${bucketName}`
    };
    nextLoadConfig.mockReturnValueOnce(nextConfig);

    return parseNextConfiguration(configDir).then(config => {
      expect(config).toEqual(
        expect.objectContaining({
          nextBuildDir: distDir
        })
      );
    });
  });
});
