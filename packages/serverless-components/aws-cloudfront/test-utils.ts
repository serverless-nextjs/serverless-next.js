import fse from "fs-extra";
import os from "os";
import path from "path";
import CloudFrontComponent from "./src/component";

export const createComponent = async (): Promise<CloudFrontComponent> => {
  // mock to prevent jest snapshots changing every time
  Date.now = () => 1566599541192;

  // create tmp folder to avoid state collisions between tests
  const tmpFolder = await fse.mkdtemp(path.join(os.tmpdir(), "test-"));

  // @ts-ignore
  const component = new CloudFrontComponent("TestCloudFront", {
    stateRoot: tmpFolder
  });

  await component.init();

  return component;
};

export const assertHasCacheBehavior = (spy, cacheBehavior): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        CacheBehaviors: expect.objectContaining({
          Items: expect.arrayContaining([
            expect.objectContaining(cacheBehavior)
          ])
        })
      })
    })
  );
};

export const assertCDWTHasCacheBehavior = (spy, cacheBehavior): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfigWithTags: expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          CacheBehaviors: expect.objectContaining({
            Items: expect.arrayContaining([
              expect.objectContaining(cacheBehavior)
            ])
          })
        })
      })
    })
  );
};

export const assertHasOriginCount = (spy, expectedCount): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        Origins: expect.objectContaining({
          Quantity: expectedCount
        })
      })
    })
  );
};

export const assertCDWTHasOriginCount = (spy, expectedCount): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfigWithTags: expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Origins: expect.objectContaining({
            Quantity: expectedCount
          })
        })
      })
    })
  );
};

export const assertHasOrigin = (spy, origin): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        Origins: expect.objectContaining({
          Items: expect.arrayContaining([expect.objectContaining(origin)])
        })
      })
    })
  );
};

export const assertCDWTHasOrigin = (spy, origin): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfigWithTags: expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Origins: expect.objectContaining({
            Items: expect.arrayContaining([expect.objectContaining(origin)])
          })
        })
      })
    })
  );
};

export const assertHasCustomOriginConfig = (spy, originConfig): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        Origins: expect.objectContaining({
          Items: expect.arrayContaining([
            expect.objectContaining({
              CustomOriginConfig: expect.objectContaining(originConfig)
            })
          ])
        })
      })
    })
  );
};

export const assertCDWTHasCustomOriginConfig = (spy, originConfig): void => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfigWithTags: expect.objectContaining({
        DistributionConfig: expect.objectContaining({
          Origins: expect.objectContaining({
            Items: expect.arrayContaining([
              expect.objectContaining({
                CustomOriginConfig: expect.objectContaining(originConfig)
              })
            ])
          })
        })
      })
    })
  );
};
