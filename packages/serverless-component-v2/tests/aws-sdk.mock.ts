type PromisifiedAWSMethod = {
  mockFunction: jest.Mock;
  mockPromise: jest.Mock;
};

const promisify = (): PromisifiedAWSMethod => {
  const mockFunction = jest.fn();
  const mockPromise = jest.fn(() => Promise.resolve());

  mockFunction.mockReturnValue({
    promise: mockPromise
  });

  return {
    mockFunction,
    mockPromise
  };
};

const {
  mockFunction: mockCreateCloudFrontDistribution,
  mockPromise: mockCreateCloudFrontDistributionPromise
} = promisify();

const MockedCloudFront = jest.fn();
MockedCloudFront.prototype.createDistribution = mockCreateCloudFrontDistribution;

export {
  mockCreateCloudFrontDistribution,
  mockCreateCloudFrontDistributionPromise
};

export default {
  CloudFront: MockedCloudFront
};
