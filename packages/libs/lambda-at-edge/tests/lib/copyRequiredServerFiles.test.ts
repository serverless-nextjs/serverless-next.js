import fse from "fs-extra";

import { copyRequiredServerFiles } from "../../src/lib/copyRequiredServerFiles";

const mockReadJSON = jest
  .spyOn(fse, "readJSON")
  .mockImplementation(async () => {
    await Promise.resolve();
    // @ts-expect-error: throw by default
    return JSON.parse(undefined);
  });

const mockCopy = jest
  .spyOn(fse, "copy")
  .mockImplementation(() => Promise.resolve());

describe("copyRequiredServerFiles", () => {
  const OPTIONS = {
    nextConfigDir: "/app",
    destination: "/serverless-nextjs/default-lambda"
  };

  beforeEach(() => {
    mockReadJSON.mockClear();
    mockCopy.mockClear();
  });

  it("should throw with missing file", async () => {
    await expect(copyRequiredServerFiles(OPTIONS)).rejects.toEqual(
      "Failed to process `required-server-files.json`. Check that you're using the `outputFileTracing` option with Node.js 12."
    );

    expect(mockReadJSON).toHaveBeenCalledTimes(1);
    expect(mockReadJSON).toHaveBeenCalledWith(
      "/app/.next/required-server-files.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should throw with invalid file", async () => {
    // File missing `files: string[]`
    mockReadJSON.mockImplementation(() => Promise.resolve({}));

    await expect(copyRequiredServerFiles(OPTIONS)).rejects.toEqual(
      "Failed to process `required-server-files.json`. Check that you're using the `outputFileTracing` option with Node.js 12."
    );

    expect(mockReadJSON).toHaveBeenCalledTimes(1);
    expect(mockReadJSON).toHaveBeenCalledWith(
      "/app/.next/required-server-files.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should resolve with valid file without any traces", async () => {
    mockReadJSON.mockImplementation(() => Promise.resolve({ files: [] }));

    await expect(copyRequiredServerFiles(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(1);
    expect(mockReadJSON).toHaveBeenCalledWith(
      "/app/.next/required-server-files.json"
    );

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("should copy trace from same directory", async () => {
    mockReadJSON.mockImplementationOnce(() =>
      Promise.resolve({
        files: ["./file_1.js"]
      })
    );

    await expect(copyRequiredServerFiles(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(1);
    expect(mockReadJSON).toHaveBeenCalledWith(
      "/app/.next/required-server-files.json"
    );

    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledWith(
      "/app/file_1.js",
      "/serverless-nextjs/default-lambda/file_1.js",
      { errorOnExist: false }
    );
  });

  it("should copy trace from node_modules", async () => {
    mockReadJSON.mockImplementationOnce(() =>
      Promise.resolve({
        files: ["./node_modules/module/index.js"]
      })
    );

    await expect(copyRequiredServerFiles(OPTIONS)).resolves.toEqual(undefined);

    expect(mockReadJSON).toHaveBeenCalledTimes(1);
    expect(mockReadJSON).toHaveBeenCalledWith(
      "/app/.next/required-server-files.json"
    );

    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledWith(
      "/app/node_modules/module/index.js",
      "/serverless-nextjs/default-lambda/node_modules/module/index.js",
      { errorOnExist: false }
    );
  });
});
