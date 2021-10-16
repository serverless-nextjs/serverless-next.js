import { Readable } from "stream";
import { jest } from "@jest/globals";

export const mockSend = jest.fn((input: any) => {
  if (input.Command === "GetObjectCommand") {
    // Simulate fallback page cache control headers
    const isFallback = /\[.*]/.test(input.Key as string);
    const cacheControl = isFallback
      ? "public, max-age=0, s-maxage=0, must-revalidate"
      : "public, max-age=0, s-maxage=2678400, must-revalidate";

    return {
      Body: Readable.from(["S3Body"]),
      CacheControl: cacheControl
    };
  } else {
    return {};
  }
});

const MockS3Client = jest.fn(() => ({
  constructor: () => {
    // intentionally empty
  },
  send: mockSend
}));

// This mock makes it easier to unit test by returning params with the command name
const MockGetObjectCommand = jest.fn((params: Record<string, string>) => {
  return {
    ...{
      Command: "GetObjectCommand"
    },
    ...params
  };
});

// This mock makes it easier to unit test by returning params with the command name
const MockPutObjectCommand = jest.fn((params: any) => {
  return {
    ...{
      Command: "PutObjectCommand"
    },
    ...params
  };
});

export {
  MockS3Client as S3Client,
  MockGetObjectCommand as GetObjectCommand,
  MockGetObjectCommand,
  MockPutObjectCommand as PutObjectCommand
};
