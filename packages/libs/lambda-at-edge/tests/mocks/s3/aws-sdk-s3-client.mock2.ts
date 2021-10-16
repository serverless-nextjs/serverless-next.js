import { jest } from "@jest/globals";

const mockSend = jest.fn();
const mockS3Client = jest.fn(() => ({
  send: mockSend
}));
const mockGetObjectCommand = jest.fn();
const mockPutObjectCommand = jest.fn();

export {
  mockS3Client as S3Client,
  mockGetObjectCommand as GetObjectCommand,
  mockPutObjectCommand as PutObjectCommand,
  mockS3Client,
  mockGetObjectCommand,
  mockPutObjectCommand,
  mockSend
};
