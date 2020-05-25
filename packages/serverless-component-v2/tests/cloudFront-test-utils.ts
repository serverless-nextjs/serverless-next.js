import AWS from "aws-sdk";

export const assertHasCacheBehavior = (
  spy: jest.Mock,
  cacheBehavior: Partial<AWS.CloudFront.CacheBehavior>
): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        CacheBehaviors: expect.objectContaining({
          Items: [expect.objectContaining(cacheBehavior)]
        })
      })
    })
  );
};

export const assertHasDefaultCacheBehaviour = (
  spy: jest.Mock,
  defaultCacheBehaviour: Partial<AWS.CloudFront.DefaultCacheBehavior>
): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        DefaultCacheBehaviour: expect.objectContaining(defaultCacheBehaviour)
      })
    })
  );
};

export const assertHasOrigin = (
  spy: jest.Mock,
  origin: Partial<AWS.CloudFront.Origin>
): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        Origins: expect.objectContaining({
          Items: [expect.objectContaining(origin)]
        })
      })
    })
  );
};
