declare module "aws-sdk" {
  const mockCreateFunction: jest.Mock;
  const mockCreateCloudFrontDistribution: jest.Mock;
  const mockCreateCloudFrontDistributionPromise: jest.Mock;
  const MockedLambda: jest.Mock;
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

export const mockCreateFunction = jest.fn();
export const mockCreateFunctionPromise = promisify(mockCreateFunction);
export const MockedLambda = jest.fn(() => ({
  createFunction: mockCreateFunction
}));

export default {
  CloudFront: MockedCloudFront,
  Lambda: MockedLambda
};
