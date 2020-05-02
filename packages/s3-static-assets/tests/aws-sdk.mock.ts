declare module "aws-sdk" {
  const mockUpload: jest.Mock;
  const mockGetBucketAccelerateConfiguration: jest.Mock;
  const mockGetBucketAccelerateConfigurationPromise: jest.Mock;
}

const promisifyMock = (mockFn: jest.Mock): jest.Mock => {
  const promise = jest.fn();
  mockFn.mockReturnValue({ promise });
  return promise;
};

export const mockGetBucketAccelerateConfiguration = jest.fn();
export const mockUpload = jest.fn();
export const mockUploadPromise = promisifyMock(mockUpload);
export const mockGetBucketAccelerateConfigurationPromise = promisifyMock(
  mockGetBucketAccelerateConfiguration
).mockImplementation(() => ({
  Status: "Suspended"
}));

const MockS3 = jest.fn(() => ({
  upload: mockUpload,
  getBucketAccelerateConfiguration: mockGetBucketAccelerateConfiguration
}));

export default {
  S3: MockS3
};
