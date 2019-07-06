const { when } = require("jest-when");
const fse = require("fs-extra");
const clone = require("lodash.clonedeep");
const path = require("path");
const addCustomStackResources = require("../addCustomStackResources");
const ServerlessPluginBuilder = require("../../utils/test/ServerlessPluginBuilder");
const getAssetsBucketName = require("../getAssetsBucketName");
const logger = require("../../utils/logger");

jest.mock("../getAssetsBucketName");
jest.mock("../../utils/logger");

describe("addCustomStackResources", () => {
  beforeEach(() => {
    fse.pathExists = jest.fn();
    fse.readdir = jest.fn();

    fse.pathExists.mockResolvedValue(false);
  });

  describe("When cloudfront is disabled and S3 bucket is configured", () => {
    const bucketName = "bucket-123";
    const bucketUrl = `https://s3.amazonaws.com/${bucketName}`;

    beforeEach(() => {
      getAssetsBucketName.mockReturnValueOnce(bucketName);
    });

    it("adds S3 bucket to resources", () => {
      expect.assertions(3);

      const coreCfTemplate = {
        Resources: {
          existingResource: "existingValue"
        }
      };

      const plugin = new ServerlessPluginBuilder().build();

      plugin.serverless.service.provider.coreCloudFormationTemplate = clone(
        coreCfTemplate
      );

      return addCustomStackResources.call(plugin).then(() => {
        expect(logger.log).toBeCalledWith(
          expect.stringContaining(`Found bucket "${bucketName}"`)
        );
        const { service } = plugin.serverless;
        const { NextStaticAssetsS3Bucket } = service.resources.Resources;

        expect(NextStaticAssetsS3Bucket.Properties.BucketName).toEqual(
          bucketName
        );
        expect(
          service.provider.coreCloudFormationTemplate.Resources.existingResource
        ).toEqual("existingValue");
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
  });

  describe("when cloudfront is enabled and S3 bucket is configured", () => {
    const findOrigin = (distribution, originId) =>
      distribution.Origins.find(o => o.Id === originId);

    let assetsBucketName = "foo.bar";
    let resources;

    beforeEach(() => {
      const plugin = new ServerlessPluginBuilder()
        .withPluginConfig({
          cloudFront: true
        })
        .build();

      const publicDir = path.join(
        plugin.getPluginConfigValue("nextConfigDir"),
        "public"
      );

      getAssetsBucketName.mockReturnValue(assetsBucketName);

      when(fse.pathExists)
        .calledWith(publicDir)
        .mockResolvedValue(false);

      return addCustomStackResources.call(plugin).then(() => {
        resources = plugin.serverless.service.resources;
      });
    });

    it("adds distribution", () => {
      const { Resources } = resources;
      expect(Object.keys(Resources)).toHaveLength(2); // S3 bucket and CloudFront distribution
      const { NextjsCloudFront } = Resources;
      expect(NextjsCloudFront).toBeDefined();
    });

    it("sets up S3 origin", () => {
      const {
        Resources: { NextjsCloudFront }
      } = resources;

      const staticOrigin = findOrigin(
        NextjsCloudFront.Properties.DistributionConfig,
        "S3Origin"
      );

      expect(staticOrigin.DomainName).toEqual(
        `${assetsBucketName}.s3.amazonaws.com`
      );
    });

    it("sets up S3 origin for /public directory", () => {
      const {
        Resources: { NextjsCloudFront }
      } = resources;

      const publicOrigin = findOrigin(
        NextjsCloudFront.Properties.DistributionConfig,
        "S3PublicOrigin"
      );

      expect(publicOrigin.DomainName).toEqual(
        `${assetsBucketName}.s3.amazonaws.com`
      );
    });

    it("sets up Api Gateway origin", () => {
      const {
        Resources: { NextjsCloudFront }
      } = resources;

      const apiGatewayOrigin = findOrigin(
        NextjsCloudFront.Properties.DistributionConfig,
        "ApiGatewayOrigin"
      );

      expect(apiGatewayOrigin.OriginPath).toEqual("/test");
      expect(apiGatewayOrigin.DomainName["Fn::Join"][1][1]).toEqual(
        ".execute-api.us-east-1.amazonaws.com"
      );
    });

    describe("when public folder exists", () => {
      it("adds cache behaviours for public files", () => {
        expect.assertions(4);

        const plugin = new ServerlessPluginBuilder()
          .withPluginConfig({
            cloudFront: true
          })
          .build();

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
            NextjsCloudFront
          } = plugin.serverless.service.resources.Resources;

          expect(NextjsCloudFront).toBeDefined();

          const {
            CacheBehaviors
          } = NextjsCloudFront.Properties.DistributionConfig;

          expect(CacheBehaviors).toHaveLength(4); // behavior for static/*, _next/* origins and 2 other behaviours for robots and manifest
          expect(CacheBehaviors[2].PathPattern).toEqual("robots.txt");
          expect(CacheBehaviors[3].PathPattern).toEqual("manifest.json");
        });
      });
    });

    describe("when cloudfront configuration is overridden by user", () => {
      it("adds user provided config to distribution", () => {
        expect.assertions(1);

        const plugin = new ServerlessPluginBuilder()
          .withPluginConfig({
            cloudFront: {
              Properties: {
                DistributionConfig: {
                  Aliases: ["myalias.com"]
                }
              }
            }
          })
          .build();

        return addCustomStackResources.call(plugin).then(() => {
          const {
            NextjsCloudFront
          } = plugin.serverless.service.resources.Resources;
          expect(
            NextjsCloudFront.Properties.DistributionConfig.Aliases
          ).toEqual(["myalias.com"]);
        });
      });
    });
  });

  describe("When no bucket is configured", () => {
    beforeEach(() => {
      getAssetsBucketName.mockReset();
      getAssetsBucketName.mockReturnValue(null);
    });

    it("doesn't add any custom resources", () => {
      expect.assertions(3);

      const plugin = new ServerlessPluginBuilder().build();

      return addCustomStackResources.call(plugin).then(() => {
        expect(logger.log).not.toBeCalled();
        expect(plugin.serverless.service.resources).toEqual(undefined);
        expect(
          plugin.serverless.service.provider.coreCloudFormationTemplate
        ).toEqual(undefined);
      });
    });
  });
});
