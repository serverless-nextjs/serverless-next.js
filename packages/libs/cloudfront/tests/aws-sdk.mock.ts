declare module "aws-sdk" {
  const mockCreateInvalidation: jest.Mock;
  const mockCreateInvalidationPromise: jest.Mock;
  const mockGetDistribution: jest.Mock;
  const mockGetDistributionPromise: jest.Mock;
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

export const mockGetDistribution = jest.fn();
export const mockGetDistributionPromise = promisifyMock(mockGetDistribution);

const MockCloudFront = jest.fn(() => ({
  createInvalidation: mockCreateInvalidation,
  getDistribution: mockGetDistribution
}));

export default {
  CloudFront: MockCloudFront
};
