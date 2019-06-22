const { when } = require("jest-when");
const yaml = require("js-yaml");
const fse = require("fs-extra");
const clone = require("lodash.clonedeep");
const merge = require("lodash.merge");
const path = require("path");
const addCustomStackResources = require("../addCustomStackResources");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const getAssetsBucketName = require("../getAssetsBucketName");
const logger = require("../../utils/logger");

jest.mock("../getAssetsBucketName");
jest.mock("fs-extra");
jest.mock("js-yaml");
jest.mock("../../utils/logger");

describe("addCustomStackResources", () => {
  const bucketName = "bucket-123";
  const bucketUrl = `https://s3.amazonaws.com/${bucketName}`;

  const s3ResourcesYmlString = `
      Resources:
        NextStaticAssetsS3Bucket:...
    `;
  const proxyResourcesYmlString = `
      Resources:
        ProxyResource:...
    `;
  const staticProxyResourcesYmlString = `
      resources:
        Resources:
          StaticAssetsProxyResource:...
    `;

  const nextProxyResourcesYmlString = `
      resources:
        Resources:
          NextStaticAssetsProxyResource:...
    `;

  let s3Resources;
  let baseProxyResource;
  let baseStaticProxyResource;
  let baseNextProxyResource;

  beforeEach(() => {
    s3Resources = {
      Resources: {
        NextStaticAssetsS3Bucket: {
          Properties: {
            BucketName: "TO_BE_REPLACED"
          }
        }
      }
    };

    baseProxyResource = {
      Resources: {
        ProxyResource: {
          Properties: {
            PathPart: "TO_BE_REPLACED"
          }
        },
        ProxyMethod: {
          Properties: {
            Integration: {
              Uri: "TO_BE_REPLACED"
            },
            ResourceId: {
              Ref: "TO_BE_REPLACED"
            }
          }
        }
      }
    };

    baseStaticProxyResource = {
      resources: {
        Resources: {
          StaticAssetsProxyParentResource: {
            Properties: {
              PathPart: "TO_BE_REPLACED"
            }
          },
          StaticAssetsProxyResource: {
            Properties: {
              PathPart: "TO_BE_REPLACED"
            }
          },
          StaticAssetsProxyMethod: {
            Properties: {
              Integration: {
                Uri: "TO_BE_REPLACED"
              },
              ResourceId: {
                Ref: "TO_BE_REPLACED"
              }
            }
          }
        }
      }
    };

    baseNextProxyResource = {
      resources: {
        Resources: {
          NextStaticAssetsProxyParentResource: {
            Properties: {
              PathPart: "TO_BE_REPLACED"
            }
          },
          NextStaticAssetsProxyResource: {
            Properties: {
              PathPart: "TO_BE_REPLACED"
            }
          },
          NextStaticAssetsProxyMethod: {
            Properties: {
              Integration: {
                Uri: "TO_BE_REPLACED"
              },
              ResourceId: {
                Ref: "TO_BE_REPLACED"
              }
            }
          }
        }
      }
    };

    fse.pathExists.mockResolvedValue(false);

    when(fse.readFile)
      .calledWith(expect.stringContaining("assets-bucket.yml"), "utf-8")
      .mockResolvedValueOnce(s3ResourcesYmlString);

    when(yaml.safeLoad)
      .calledWith(s3ResourcesYmlString, expect.any(Object))
      .mockReturnValueOnce(s3Resources);

    when(fse.readFile)
      .calledWith(expect.stringContaining("api-gw-proxy.yml"), "utf-8")
      .mockResolvedValueOnce(proxyResourcesYmlString);

    when(yaml.safeLoad)
      .calledWith(proxyResourcesYmlString, expect.any(Object))
      .mockReturnValueOnce(baseProxyResource);

    when(fse.readFile)
      .calledWith(expect.stringContaining("api-gw-next.yml"), "utf-8")
      .mockResolvedValueOnce(nextProxyResourcesYmlString);

    when(yaml.safeLoad)
      .calledWith(nextProxyResourcesYmlString, expect.any(Object))
      .mockReturnValueOnce(baseNextProxyResource);

    when(fse.readFile)
      .calledWith(expect.stringContaining("api-gw-static.yml"), "utf-8")
      .mockResolvedValueOnce(staticProxyResourcesYmlString);

    when(yaml.safeLoad)
      .calledWith(staticProxyResourcesYmlString, expect.any(Object))
      .mockReturnValueOnce(baseStaticProxyResource);

    getAssetsBucketName.mockReturnValueOnce(bucketName);
  });

  it("adds S3 bucket to resources", () => {
    expect.assertions(3);

    const coreCfTemplate = {
      Resources: {
        foo: "bar"
      }
    };
    const s3ResourcesWithBucketName = clone(s3Resources);
    s3ResourcesWithBucketName.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

    const plugin = new ServerlessPluginBuilder().build();

    plugin.serverless.service.provider.coreCloudFormationTemplate = clone(
      coreCfTemplate
    );

    return addCustomStackResources.call(plugin).then(() => {
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(`Found bucket "${bucketName}"`)
      );
      expect(
        plugin.serverless.service.resources.Resources.NextStaticAssetsS3Bucket
          .Properties.BucketName
      ).toEqual(bucketName);
      expect(
        plugin.serverless.service.provider.coreCloudFormationTemplate
      ).toEqual(merge(coreCfTemplate, s3ResourcesWithBucketName));
    });
  });

  it("adds proxy routes for static directory", () => {
    expect.assertions(2);

    const plugin = new ServerlessPluginBuilder().build();

    const staticDir = path.join(
      plugin.getPluginConfigValue("nextConfigDir"),
      "static"
    );

    when(fse.pathExists)
      .calledWith(staticDir)
      .mockResolvedValue(true);

    return addCustomStackResources.call(plugin).then(() => {
      const resources = plugin.serverless.service.resources.Resources;
      expect(Object.keys(resources)).toEqual(
        expect.arrayContaining([
          "StaticAssetsProxyParentResource",
          "StaticAssetsProxyResource",
          "StaticAssetsProxyMethod"
        ])
      );
      expect(
        resources.StaticAssetsProxyMethod.Properties.Integration.Uri
      ).toEqual("https://s3.amazonaws.com/bucket-123/static/{proxy}");
    });
  });

  it("adds proxy routes for nextjs assets", () => {
    expect.assertions(2);

    const plugin = new ServerlessPluginBuilder().build();

    return addCustomStackResources.call(plugin).then(() => {
      const resources = plugin.serverless.service.resources.Resources;
      expect(Object.keys(resources)).toEqual(
        expect.arrayContaining([
          "NextStaticAssetsProxyParentResource",
          "NextStaticAssetsProxyResource",
          "NextStaticAssetsProxyMethod"
        ])
      );
      expect(
        resources.NextStaticAssetsProxyMethod.Properties.Integration.Uri
      ).toEqual("https://s3.amazonaws.com/bucket-123/_next/{proxy}");
    });
  });

  it("adds proxy route to each file in the public folder", () => {
    expect.assertions(8);

    const plugin = new ServerlessPluginBuilder().build();
    const publicDir = path.join(
      plugin.getPluginConfigValue("nextConfigDir"),
      "public"
    );

    when(fse.pathExists)
      .calledWith(publicDir)
      .mockResolvedValue(true);

    when(fse.readdir)
      .calledWith(publicDir)
      .mockResolvedValue(["robots.txt", "manifest.json"]);

    return addCustomStackResources.call(plugin).then(() => {
      const {
        RobotsProxyMethod,
        RobotsProxyResource,
        ManifestProxyMethod,
        ManifestProxyResource
      } = plugin.serverless.service.resources.Resources;

      expect(RobotsProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrl}/public/robots.txt`
      );
      expect(RobotsProxyMethod.Properties.ResourceId.Ref).toEqual(
        "RobotsProxyResource"
      );
      expect(RobotsProxyResource.Properties.PathPart).toEqual("robots.txt");
      expect(logger.log).toBeCalledWith(
        `Proxying robots.txt -> ${bucketUrl}/public/robots.txt`
      );

      expect(ManifestProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrl}/public/manifest.json`
      );
      expect(ManifestProxyMethod.Properties.ResourceId.Ref).toEqual(
        "ManifestProxyResource"
      );
      expect(ManifestProxyResource.Properties.PathPart).toEqual(
        `manifest.json`
      );
      expect(logger.log).toBeCalledWith(
        `Proxying manifest.json -> ${bucketUrl}/public/manifest.json`
      );
    });
  });

  it("adds proxy route to resources with correct bucket url for the region", () => {
    expect.assertions(2);

    const euWestRegion = "eu-west-1";
    const bucketUrlIreland = `https://s3-${euWestRegion}.amazonaws.com/${bucketName}`;
    const getRegion = jest.fn().mockReturnValueOnce(euWestRegion);

    const plugin = new ServerlessPluginBuilder().build();

    const publicDir = path.join(
      plugin.getPluginConfigValue("nextConfigDir"),
      "public"
    );

    when(fse.pathExists)
      .calledWith(publicDir)
      .mockResolvedValue(true);

    when(fse.readdir)
      .calledWith(publicDir)
      .mockResolvedValue(["robots.txt"]);

    plugin.provider.getRegion = getRegion;

    return addCustomStackResources.call(plugin).then(() => {
      const {
        RobotsProxyMethod
      } = plugin.serverless.service.resources.Resources;

      expect(getRegion).toBeCalled();
      expect(RobotsProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrlIreland}/public/robots.txt`
      );
    });
  });

  describe("When no bucket available", () => {
    beforeEach(() => {
      getAssetsBucketName.mockReset();
      getAssetsBucketName.mockReturnValue(null);
    });

    it("doesn't add S3 bucket to resources", () => {
      expect.assertions(5);

      const plugin = new ServerlessPluginBuilder().build();

      return addCustomStackResources.call(plugin).then(() => {
        expect(logger.log).not.toBeCalled();
        expect(fse.readFile).not.toBeCalled();
        expect(yaml.safeLoad).not.toBeCalled();
        expect(plugin.serverless.service.resources).toEqual(undefined);
        expect(
          plugin.serverless.service.provider.coreCloudFormationTemplate
        ).toEqual(undefined);
      });
    });
  });
});
