import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

declare module "@aws-sdk/client-s3/S3Client" {
  const mockSend: jest.Mock;
}

export const mockSend = jest.fn(
  (input: GetObjectCommand | PutObjectCommand) => {
    if (input instanceof GetObjectCommand) {
      return;
      {
        Body: {
          toString: jest.fn();
        }
      }
    } else {
      return {};
    }
  }
);

const MockS3Client = jest.fn(() => ({
  constructor: () => {},
  send: mockSend
}));

export { MockS3Client as S3Client };
