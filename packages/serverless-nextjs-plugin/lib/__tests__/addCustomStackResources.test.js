const { when } = require("jest-when");
const yaml = require("js-yaml");
const fse = require("fs-extra");
const clone = require("lodash.clonedeep");
const merge = require("lodash.merge");
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

  let s3Resources;
  let baseProxyResource;

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

  it("merges single static proxy route to resources", () => {
    expect.assertions(5);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir: "./public",
        routes: [
          {
            src: "./public/robots.txt",
            path: "robots.txt"
          }
        ]
      })
      .build();

    plugin.serverless.service.resources = {
      Resources: {
        Foo: "bar"
      }
    };

    return addCustomStackResources.call(plugin).then(() => {
      const resources = plugin.serverless.service.resources.Resources;

      const { RobotsProxyMethod, RobotsProxyResource, Foo } = resources;

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
      // make sure resources are merged and completely overridden
      expect(Foo).toEqual("bar");
    });
  });

  it("adds static proxy route to resources when src filenames are same but different sub directories", () => {
    expect.assertions(8);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir: "./public",
        routes: [
          {
            src: "./public/foo/bar.js",
            path: "foo/bar.js"
          },
          {
            src: "./public/bar.js",
            path: "bar.js"
          }
        ]
      })
      .build();

    return addCustomStackResources.call(plugin).then(() => {
      const {
        FooBarProxyMethod,
        FooBarProxyResource,
        BarProxyMethod,
        BarProxyResource
      } = plugin.serverless.service.resources.Resources;

      expect(FooBarProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrl}/public/foo/bar.js`
      );
      expect(FooBarProxyMethod.Properties.ResourceId.Ref).toEqual(
        "FooBarProxyResource"
      );
      expect(FooBarProxyResource.Properties.PathPart).toEqual("foo/bar.js");
      expect(logger.log).toBeCalledWith(
        `Proxying foo/bar.js -> ${bucketUrl}/public/foo/bar.js`
      );

      expect(BarProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrl}/public/bar.js`
      );
      expect(BarProxyMethod.Properties.ResourceId.Ref).toEqual(
        "BarProxyResource"
      );
      expect(BarProxyResource.Properties.PathPart).toEqual(`bar.js`);
      expect(logger.log).toBeCalledWith(
        `Proxying bar.js -> ${bucketUrl}/public/bar.js`
      );
    });
  });

  it("adds static proxy route to resources with correct bucket url for the region", () => {
    expect.assertions(2);

    const euWestRegion = "eu-west-1";
    const bucketUrlIreland = `https://s3-${euWestRegion}.amazonaws.com/${bucketName}`;
    const getRegion = jest.fn().mockReturnValueOnce(euWestRegion);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir: "./public",
        routes: [
          {
            src: "./public/foo/bar.js",
            path: "foo/bar.js"
          }
        ]
      })
      .build();

    plugin.provider.getRegion = getRegion;

    return addCustomStackResources.call(plugin).then(() => {
      const {
        FooBarProxyMethod
      } = plugin.serverless.service.resources.Resources;

      expect(getRegion).toBeCalled();
      expect(FooBarProxyMethod.Properties.Integration.Uri).toEqual(
        `${bucketUrlIreland}/public/foo/bar.js`
      );
    });
  });

  it("doesn't add static proxy route to resources if src isn't a sub path of staticDir", () => {
    expect.assertions(1);

    const plugin = new ServerlessPluginBuilder()
      .withPluginConfig({
        staticDir: "./public",
        routes: [
          {
            src: "assets/public/sw.js",
            path: "proxied/sw.js"
          },
          {
            src: "static/sw.js",
            path: "proxied/sw.js"
          }
        ]
      })
      .build();

    return addCustomStackResources.call(plugin).then(() => {
      const resources = plugin.serverless.service.resources.Resources;
      // should only contain bucket
      expect(Object.keys(resources)).toEqual(["NextStaticAssetsS3Bucket"]);
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

  describe("When no staticDir given", () => {
    it("doesn't add any static proxy routes", () => {
      expect.assertions(1);

      const plugin = new ServerlessPluginBuilder()
        .withPluginConfig({
          staticDir: undefined,
          routes: [
            {
              src: "static/sw.js",
              path: "proxied/sw.js"
            }
          ]
        })
        .build();

      return addCustomStackResources.call(plugin).then(() => {
        const resources = plugin.serverless.service.resources.Resources;
        // should only contain bucket
        expect(Object.keys(resources)).toEqual(["NextStaticAssetsS3Bucket"]);
      });
    });
  });
});
