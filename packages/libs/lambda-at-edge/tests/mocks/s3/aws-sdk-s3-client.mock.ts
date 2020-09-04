declare module "@aws-sdk/client-s3/S3Client" {
  const mockSend: jest.Mock;
}

export const mockSend = jest.fn((input) => {
  if (input.Command === "GetObjectCommand") {
    return {
      Body: {
        toString: jest.fn(() => "S3Body")
      }
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
