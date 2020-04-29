const promisifyMock = (mockFn: jest.Mock): jest.Mock => {
  const promise = jest.fn();
  mockFn.mockReturnValue({ promise });
  return promise;
};

export const mockUpload = jest.fn();
export const mockUploadPromise = promisifyMock(mockUpload);

const MockS3 = jest.fn(() => ({
  upload: mockUpload
}));

export default {
  S3: MockS3
};
