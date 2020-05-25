declare module "aws-sdk" {
  const mockCreateCloudFrontDistribution: jest.Mock;
  const mockCreateCloudFrontDistributionPromise: jest.Mock;
  const MockedCloudFront: jest.Mock;
}

const promisify = (mockFunction: jest.Mock): jest.Mock => {
  const mockPromise = jest.fn(() => Promise.resolve());

  mockFunction.mockReturnValue({
    promise: mockPromise
  });

  return mockPromise;
};

export const mockCreateCloudFrontDistribution = jest.fn();
export const mockCreateCloudFrontDistributionPromise = promisify(
  mockCreateCloudFrontDistribution
);

export const MockedCloudFront = jest.fn(() => ({
  createDistribution: mockCreateCloudFrontDistribution
}));

export default {
  CloudFront: MockedCloudFront
};
