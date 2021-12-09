declare module "aws-sdk" {
  const mockUpload: jest.Mock;
  const mockGetBucketAccelerateConfiguration: jest.Mock;
  const mockGetBucketAccelerateConfigurationPromise: jest.Mock;
  const mockGetObject: jest.Mock;
  const mockGetObjectPromise: jest.Mock;
  const mockListObjectsV2: jest.Mock;
  const mockListObjectsV2Promise: jest.Mock;
  const mockDeleteObjects: jest.Mock;
  const mockDeleteObjectsPromise: jest.Mock;
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

export const mockGetObject = jest.fn();
export const mockGetObjectPromise = promisifyMock(mockGetObject);
export const mockListObjectsV2 = jest.fn();
export const mockListObjectsV2Promise = promisifyMock(mockListObjectsV2);
export const mockDeleteObjects = jest.fn();
export const mockDeleteObjectsPromise = promisifyMock(mockDeleteObjects);

const MockS3 = jest.fn(() => ({
  upload: mockUpload,
  getBucketAccelerateConfiguration: mockGetBucketAccelerateConfiguration,
  getObject: mockGetObject,
  listObjectsV2: mockListObjectsV2,
  deleteObjects: mockDeleteObjects
}));

export default {
  S3: MockS3
};
