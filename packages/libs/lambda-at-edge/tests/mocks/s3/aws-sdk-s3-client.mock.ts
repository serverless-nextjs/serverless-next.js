import { Readable } from "stream";

export const mockSend = jest.fn((input) => {
  if (input.Command === "GetObjectCommand") {
    return {
      Body: Readable.from(["S3Body"])
    };
  } else {
    return {};
  }
});

const MockS3Client = jest.fn(() => ({
  constructor: () => {},
  send: mockSend
}));

export { MockS3Client as S3Client };
