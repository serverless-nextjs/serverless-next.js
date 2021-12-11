import fse from "fs-extra";

import { copyOutputFileTraces } from "../../src/lib/copyOutputFileTraces";

const mockReadJSON = jest.spyOn(fse, "readJSON");
const mockCopy = jest.spyOn(fse, "copy");

describe("copyOutputFileTraces", () => {
  const OPTIONS = {
    serverlessDir: "/app/.next/serverless",
    destination: "/serverless-nextjs/default-lambda",
    pages: ["/app/.next/serverless/pages/index.js"]
  };

  beforeEach(() => {
    mockReadJSON.mockReset().mockImplementation(async () => {
      await Promise.resolve();
      // @ts-expect-error: throw by default
      return JSON.parse(undefined);
    });

    mockCopy.mockReset().mockImplementation(() => Promise.resolve());
  });

  it("should throw with missing file", async () => {
    await expect(copyOutputFileTraces(OPTIONS)).rejects.toEqual(
      "Failed to read trace `/app/.next/next-server.js.nft.json`. Check that you're using the `outputFileTracing` option with Node.js 12."
    );

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should throw with invalid file", async () => {
    // File missing `files: string[]`
    mockReadJSON.mockImplementation(() => Promise.resolve({}));

    await expect(copyOutputFileTraces(OPTIONS)).rejects.toEqual(
      "Failed to read trace `/app/.next/next-server.js.nft.json`. Check that you're using the `outputFileTracing` option with Node.js 12."
    );

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should resolve with valid file without any traces", async () => {
    mockReadJSON.mockImplementation(() => Promise.resolve({ files: [] }));

    await expect(copyOutputFileTraces(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should copy trace from same directory", async () => {
    // .next/next-server.js.nft.json
    mockReadJSON.mockImplementationOnce(() => Promise.resolve({ files: [] }));

    // .next/serverless/pages/index.js
    mockReadJSON.mockImplementationOnce(() =>
      Promise.resolve({
        files: ["./file_1.js"]
      })
    );

    await expect(copyOutputFileTraces(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledWith(
      "/app/.next/serverless/pages/file_1.js",
      "/serverless-nextjs/default-lambda/pages/file_1.js"
    );
  });

  it("should copy trace from parent directory", async () => {
    // .next/next-server.js.nft.json
    mockReadJSON.mockImplementationOnce(() => Promise.resolve({ files: [] }));

    // .next/serverless/pages/index.js
    mockReadJSON.mockImplementationOnce(() =>
      Promise.resolve({
        files: ["../file_2.js"]
      })
    );

    await expect(copyOutputFileTraces(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledWith(
      "/app/.next/serverless/file_2.js",
      "/serverless-nextjs/default-lambda/file_2.js"
    );
  });

  it("should copy trace from node_modules", async () => {
    // .next/next-server.js.nft.json
    mockReadJSON.mockImplementationOnce(() => Promise.resolve({ files: [] }));

    // .next/serverless/pages/index.js
    mockReadJSON.mockImplementationOnce(() =>
      Promise.resolve({
        files: ["../../../node_modules/module/index.js"]
      })
    );

    await expect(copyOutputFileTraces(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(2);
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      1,
      "/app/.next/next-server.js.nft.json"
    );
    expect(mockReadJSON).toHaveBeenNthCalledWith(
      2,
      "/app/.next/serverless/pages/index.js.nft.json"
    );

    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledWith(
      "/app/node_modules/module/index.js",
      "/serverless-nextjs/default-lambda/node_modules/module/index.js"
    );
  });
});
