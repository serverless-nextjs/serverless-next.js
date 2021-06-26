const promisifyMock = (mockFn: jest.Mock) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

export const mockCreateDistribution = jest.fn();
export const mockCreateDistributionPromise = promisifyMock(
  mockCreateDistribution
);

export const mockUpdateDistribution = jest.fn();
export const mockUpdateDistributionPromise = promisifyMock(
  mockUpdateDistribution
);

export const mockGetDistributionConfig = jest.fn();
export const mockGetDistributionConfigPromise = promisifyMock(
  mockGetDistributionConfig
);

export const mockDeleteDistribution = jest.fn();
export const mockDeleteDistributionPromise = promisifyMock(
  mockDeleteDistribution
);

export const mockCreateCloudFrontOriginAccessIdentity = jest.fn();
export const mockCreateCloudFrontOriginAccessIdentityPromise = promisifyMock(
  mockCreateCloudFrontOriginAccessIdentity
);

export const mockGetCloudFrontOriginAccessIdentity = jest.fn();
export const mockGetCloudFrontOriginAccessIdentityPromise = promisifyMock(
  mockGetCloudFrontOriginAccessIdentity
);

export const mockPutBucketPolicy = jest.fn();
export const mockPutBucketPolicyPromise = promisifyMock(mockPutBucketPolicy);

export default {
  CloudFront: jest.fn(() => ({
    createDistribution: mockCreateDistribution,
    updateDistribution: mockUpdateDistribution,
    getDistributionConfig: mockGetDistributionConfig,
    deleteDistribution: mockDeleteDistribution,
    createCloudFrontOriginAccessIdentity:
      mockCreateCloudFrontOriginAccessIdentity,
    getCloudFrontOriginAccessIdentity: mockGetCloudFrontOriginAccessIdentity
  })),

  S3: jest.fn(() => ({
    putBucketPolicy: mockPutBucketPolicy
  }))
};
