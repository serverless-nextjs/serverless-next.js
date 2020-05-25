declare module "aws-sdk" {
  const mockCreateCloudFrontDistribution: jest.Mock;
  const mockCreateCloudFrontDistributionPromise: jest.Mock;
}

const promisify = (mockFunction: jest.Mock): jest.Mock => {
  const mockPromise = jest.fn(() => Promise.resolve());

  mockFunction.mockReturnValue({
    promise: mockPromise
  });

  return mockPromise;
};

const mockCreateDistribution = jest.fn();
export const mockCreateCloudFrontDistributionPromise = promisify(
  mockCreateDistribution
);

const MockedCloudFront = jest.fn(() => ({
  createDistribution: mockCreateDistribution
}));

export default {
  CloudFront: MockedCloudFront
};
