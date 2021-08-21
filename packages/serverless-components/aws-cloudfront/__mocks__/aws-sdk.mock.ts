const promisifyMock = (mockFn: jest.Mock) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

export const mockCreateDistributionWithTags = jest.fn();
export const mockCreateDistributionWithTagsPromise = promisifyMock(
  mockCreateDistributionWithTags
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

export const mockUntagResource = jest.fn();
export const mockUntagResourcePromise = promisifyMock(mockUntagResource);

export const mockTagResource = jest.fn();
export const mockTagResourcePromise = promisifyMock(mockTagResource);

export const mockListTagsForResource = jest.fn();
export const mockListTagsForResourcePromise = promisifyMock(
  mockListTagsForResource
);

export default {
  CloudFront: jest.fn(() => ({
    createDistributionWithTags: mockCreateDistributionWithTags,
    updateDistribution: mockUpdateDistribution,
    getDistributionConfig: mockGetDistributionConfig,
    deleteDistribution: mockDeleteDistribution,
    createCloudFrontOriginAccessIdentity:
      mockCreateCloudFrontOriginAccessIdentity,
    getCloudFrontOriginAccessIdentity: mockGetCloudFrontOriginAccessIdentity,
    listTagsForResource: mockListTagsForResource,
    untagResource: mockUntagResource,
    tagResource: mockTagResource
  })),

  S3: jest.fn(() => ({
    putBucketPolicy: mockPutBucketPolicy
  }))
};
