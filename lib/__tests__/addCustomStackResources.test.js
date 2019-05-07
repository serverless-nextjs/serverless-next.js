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
  describe("When resources are added succesfully", () => {
    const bucketName = "bucket-123";
    const s3ResourcesYmlString = `
      Resources:
        NextStaticAssetsS3Bucket:...
    `;
    const proxyResourcesYmlString = `
      Resources:
        ProxyResource:...
    `;
    const s3Resources = {
      Resources: {
        NextStaticAssetsS3Bucket: {
          Properties: {
            BucketName: "TO_BE_REPLACED"
          }
        }
      }
    };
    const baseProxyResource = {
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
            }
          }
        }
      }
    };

    beforeEach(() => {
      when(fse.readFile)
        .calledWith(expect.stringContaining("resources.yml"), "utf-8")
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

    it("adds static proxy route resources", () => {
      expect.assertions(8);

      const plugin = new ServerlessPluginBuilder()
        .withNextCustomConfig({
          staticDir: "./public",
          routes: [
            {
              src: "./public/robots.txt",
              dest: "robots.txt"
            },
            {
              src: "./public/bar.js",
              dest: "bar.js"
            },
            {
              src: "./public/foo/bar.js",
              dest: "foo/bar.js"
            },
            {
              src: "static/sw.js",
              dest: "proxied/sw.js"
            }
          ]
        })
        .build();

      return addCustomStackResources.call(plugin).then(() => {
        const resources = plugin.serverless.service.resources.Resources;

        expect(resources.RobotsProxyMethod.Properties.Integration.Uri).toEqual(
          `https://s3.amazonaws.com/${bucketName}/public/robots.txt`
        );
        expect(resources.RobotsProxyResource.Properties.PathPart).toEqual(
          "robots.txt"
        );
        expect(resources.FooBarProxyMethod.Properties.Integration.Uri).toEqual(
          `https://s3.amazonaws.com/${bucketName}/public/foo/bar.js`
        );
        expect(resources.FooBarProxyResource.Properties.PathPart).toEqual(
          "foo/bar.js"
        );
        expect(resources.BarProxyMethod.Properties.Integration.Uri).toEqual(
          `https://s3.amazonaws.com/${bucketName}/public/bar.js`
        );
        expect(resources.BarProxyResource.Properties.PathPart).toEqual(
          "bar.js"
        );
        // should not add static/sw.js as is not the staticDir configured, /public
        expect(resources.SwProxyMethod).toBe(undefined);
        expect(resources.SwProxyResource).toBe(undefined);
      });
    });
  });

  describe("When no bucket available", () => {
    it("doesn't add S3 bucket to resources", () => {
      expect.assertions(5);

      getAssetsBucketName.mockReturnValueOnce(null);

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
