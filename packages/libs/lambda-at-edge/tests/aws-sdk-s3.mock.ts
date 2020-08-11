declare module "aws-sdk/clients/s3" {
  const mockGetObject: jest.Mock;
  const mockPutObject: jest.Mock;
}

const promisifyMock = (mockFn: jest.Mock, returnValue?: any): jest.Mock => {
  const promise = jest.fn(() => returnValue);
  mockFn.mockReturnValue({ promise });
  return promise;
};

export const mockGetObject = jest.fn();
export const mockGetObjectPromise = promisifyMock(mockGetObject, {
  Body: { toString: jest.fn() }
});
export const mockPutObject = jest.fn();
export const mockPutObjectPromise = promisifyMock(mockPutObject);

const MockS3 = jest.fn(() => ({
  getObject: mockGetObject,
  putObject: mockPutObject
}));

export default MockS3;
