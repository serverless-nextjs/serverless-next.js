declare module "aws-sdk" {
  const mockCreateInvalidation: jest.Mock;
  const mockCreateInvalidationPromise: jest.Mock;
}

const promisifyMock = (mockFn: jest.Mock): jest.Mock => {
  const promise = jest.fn();
  mockFn.mockReturnValue({ promise });
  return promise;
};

export const mockCreateInvalidation = jest.fn();
export const mockCreateInvalidationPromise = promisifyMock(
  mockCreateInvalidation
);

const MockCloudFront = jest.fn(() => ({
  createInvalidation: mockCreateInvalidation
}));

export default {
  CloudFront: MockCloudFront
};
