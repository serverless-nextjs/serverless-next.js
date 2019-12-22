const nextLoadConfig = require("next/dist/next-server/server/config").default;
const { 
    PHASE_PRODUCTION_BUILD
} = require("next/dist/next-server/lib/constants");
const parseNextConfiguration = require("../parseNextConfiguration");

jest.mock("next/dist/next-server/server/config");

describe("parseNextConfiguration", () => {
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

  it("should return empty staticAssetsBucket when no assetPrefix is configured", () => {
    nextLoadConfig.mockReturnValueOnce({
      target: "serverless"
    });

    const { staticAssetsBucket } = parseNextConfiguration("/path/to/next");
    expect(staticAssetsBucket).toBe(null);
  });

  it("should return empty staticAssetsBucket when assetPrefix exists but has no bucket", () => {
    const configDir = "/path/to/next";
    const nextConfig = {
      target: "serverless",
      assetPrefix: `https://cdn.com/assets`
    };
    nextLoadConfig.mockReturnValueOnce(nextConfig);

    const config = parseNextConfiguration(configDir);

    expect(config.staticAssetsBucket).toBe(null);
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
