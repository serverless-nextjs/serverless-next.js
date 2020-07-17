const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

const mockCreateDistribution = jest.fn();
const mockCreateDistributionPromise = promisifyMock(mockCreateDistribution);

const mockUpdateDistribution = jest.fn();
const mockUpdateDistributionPromise = promisifyMock(mockUpdateDistribution);

const mockGetDistributionConfig = jest.fn();
const mockGetDistributionConfigPromise = promisifyMock(
  mockGetDistributionConfig
);

const mockDeleteDistribution = jest.fn();
const mockDeleteDistributionPromise = promisifyMock(mockDeleteDistribution);

const mockCreateCloudFrontOriginAccessIdentity = jest.fn();
const mockCreateCloudFrontOriginAccessIdentityPromise = promisifyMock(
  mockCreateCloudFrontOriginAccessIdentity
);

const mockPutBucketPolicy = jest.fn();
const mockPutBucketPolicyPromise = promisifyMock(mockPutBucketPolicy);

module.exports = {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockGetDistributionConfig,
  mockDeleteDistribution,
  mockCreateCloudFrontOriginAccessIdentity,
  mockPutBucketPolicy,

  mockPutBucketPolicyPromise,
  mockCreateDistributionPromise,
  mockUpdateDistributionPromise,
  mockGetDistributionConfigPromise,
  mockDeleteDistributionPromise,
  mockCreateCloudFrontOriginAccessIdentityPromise,

  CloudFront: jest.fn(() => ({
    createDistribution: mockCreateDistribution,
    updateDistribution: mockUpdateDistribution,
    getDistributionConfig: mockGetDistributionConfig,
    deleteDistribution: mockDeleteDistribution,
    createCloudFrontOriginAccessIdentity: mockCreateCloudFrontOriginAccessIdentity
  })),

  S3: jest.fn(() => ({
    putBucketPolicy: mockPutBucketPolicy
  }))
};
