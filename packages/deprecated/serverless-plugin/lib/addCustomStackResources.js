const path = require("path");
const merge = require("lodash.merge");
const clone = require("lodash.clonedeep");
const getAssetsBucketName = require("./getAssetsBucketName");
const logger = require("../utils/logger");
const loadYml = require("../utils/yml/load");
const fse = require("fs-extra");

const dirInfo = async (dir) => {
  const exists = await fse.pathExists(dir);

  if (!exists) {
    return [false, []];
  }

  return [true, await fse.readdir(dir)];
};

const capitaliseFirstLetter = (str) =>
  str.charAt(0).toUpperCase() + str.slice(1);

// removes non-alphanumeric characters to adhere to AWS naming requirements
const normaliseResourceName = (str) => str.replace(/[^0-9a-zA-Z]/g, "");

// converts file path to a string which can be used in CF resource keys
// ./static/bar.js -> Bar
// ./static/foo/bar.js -> FooBar
const normaliseFilePathForCloudFrontResourceKey = (filePath) =>
  filePath
    .split(path.sep)
    .filter((s) => s !== "." && s !== "..")
    .map(capitaliseFirstLetter)
    .join("");

const cacheBehaviour = (fileName) => ({
  AllowedMethods: ["GET", "HEAD", "OPTIONS"],
  TargetOriginId: "S3PublicOrigin",
  Compress: true,
  ForwardedValues: {
    QueryString: "false",
    Cookies: { Forward: "none" }
  },
  ViewerProtocolPolicy: "https-only",
  MinTTL: "50",
  PathPattern: path.basename(fileName)
});

const getNextRouteProxyResources = async function ({
  bucketBaseUrl,
  bucketName
}) {
  const nextDir = "_next";
  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-next.yml")
  );

  const bucketUrl = `${bucketBaseUrl}/${path.posix.join(
    bucketName,
    nextDir,
    "{proxy}"
  )}`;

  let resource = clone(baseResource);

  const { Resources } = resource.resources;

  Resources.NextStaticAssetsProxyParentResource.Properties.PathPart = nextDir;
  Resources.NextStaticAssetsProxyMethod.Properties.Integration.Uri = bucketUrl;

  logger.log(`Proxying NextJS assets -> ${bucketUrl}`);

  return Resources;
};

const getStaticRouteProxyResources = async function ({
  bucketBaseUrl,
  bucketName
}) {
  const staticDir = path.join(this.nextConfigDir, "static");
  const [staticDirExists] = await dirInfo(staticDir);

  if (!staticDirExists) {
    return {};
  }

  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-static.yml")
  );

  const bucketUrl = `${bucketBaseUrl}/${path.posix.join(
    bucketName,
    "static",
    "{proxy}"
  )}`;

  let resource = clone(baseResource);
  const { Resources } = resource.resources;

  Resources.StaticAssetsProxyParentResource.Properties.PathPart = "static";
  Resources.StaticAssetsProxyMethod.Properties.Integration.Uri = bucketUrl;

  logger.log(`Proxying static files -> ${bucketUrl}`);

  return Resources;
};

const getPublicRouteProxyResources = async function ({
  bucketBaseUrl,
  bucketName
}) {
  const [publicDirExists, publicDirFiles] = await dirInfo(
    path.join(this.nextConfigDir, "public")
  );

  if (!publicDirExists) {
    return {};
  }

  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-proxy.yml")
  );

  const result = {
    Resources: {}
  };

  publicDirFiles.forEach((file) => {
    const bucketUrl = `${bucketBaseUrl}/${path.posix.join(
      bucketName,
      "public",
      file
    )}`;

    let resourceName = normaliseFilePathForCloudFrontResourceKey(file);
    resourceName = path.parse(resourceName).name;
    resourceName = normaliseResourceName(resourceName);

    const resource = clone(baseResource);

    resource.Resources.ProxyResource.Properties.PathPart = file;
    resource.Resources.ProxyMethod.Properties.ResourceId.Ref = `${resourceName}ProxyResource`;
    resource.Resources.ProxyMethod.Properties.Integration.Uri = bucketUrl;

    result.Resources[`${resourceName}ProxyResource`] =
      resource.Resources.ProxyResource;

    result.Resources[`${resourceName}ProxyMethod`] =
      resource.Resources.ProxyMethod;

    logger.log(`Proxying ${file} -> ${bucketUrl}`);
  });

  return result.Resources;
};

const addCustomStackResources = async function () {
  const region = this.provider.getRegion();
  const stage = this.provider.getStage();

  const bucketName = getAssetsBucketName.call(this);

  if (!bucketName) {
    return;
  }

  this.serverless.service.resources = this.serverless.service.resources || {
    Resources: {}
  };

  logger.log(`Found bucket "${bucketName}" from serverless.yml`);

  // see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html
  const bucketBaseUrl =
    region === "us-east-1"
      ? "https://s3.amazonaws.com"
      : `https://s3-${region}.amazonaws.com`;

  const resourceConfiguration = { bucketName, bucketBaseUrl };
  let assetsBucketResource = {};

  const createAssetBucket = this.getPluginConfigValue("createAssetBucket");

  if (createAssetBucket) {
    assetsBucketResource = await loadYml(
      path.join(__dirname, "../resources/assets-bucket.yml")
    );

    assetsBucketResource.Resources.NextStaticAssetsS3Bucket.Properties.BucketName =
      bucketName;

    merge(
      this.serverless.service.provider.coreCloudFormationTemplate,
      assetsBucketResource
    );
  }

  const cloudFront = this.getPluginConfigValue("cloudFront");

  if (cloudFront) {
    let cloudFrontResource = await loadYml(
      path.join(__dirname, "../resources/cloudfront.yml")
    );

    if (typeof cloudFront === "object") {
      merge(cloudFrontResource.Resources.NextjsCloudFront, cloudFront);
    }

    const { DistributionConfig } =
      cloudFrontResource.Resources.NextjsCloudFront.Properties;

    const findOrigin = (originId) =>
      DistributionConfig.Origins.find((o) => o.Id === originId);

    const apiGatewayOrigin = findOrigin("ApiGatewayOrigin");
    apiGatewayOrigin.OriginPath = `/${stage}`;
    apiGatewayOrigin.DomainName[
      "Fn::Join"
    ][1][1] = `.execute-api.${region}.amazonaws.com`;

    const publicOrigin = findOrigin("S3PublicOrigin");
    const staticOrigin = findOrigin("S3Origin");

    const bucketDomainName = `${bucketName}.s3.amazonaws.com`;

    publicOrigin.DomainName = bucketDomainName;
    staticOrigin.DomainName = bucketDomainName;

    const [publicDirExists, publicDirFiles] = await dirInfo(
      path.join(this.nextConfigDir, "public")
    );

    if (publicDirExists) {
      publicDirFiles.forEach((f) => {
        DistributionConfig.CacheBehaviors.push(cacheBehaviour(f));
      });
    }

    merge(
      this.serverless.service.resources,
      assetsBucketResource,
      cloudFrontResource
    );

    return;
  }

  // api gateway -> S3 proxying

  const [staticResources, nextResources, publicResources] = await Promise.all([
    getStaticRouteProxyResources.call(this, resourceConfiguration),
    getNextRouteProxyResources.call(this, resourceConfiguration),
    getPublicRouteProxyResources.call(this, resourceConfiguration)
  ]);

  const proxyResources = {
    Resources: {
      ...staticResources,
      ...nextResources,
      ...publicResources
    }
  };

  merge(
    this.serverless.service.resources,
    assetsBucketResource,
    proxyResources
  );
};

module.exports = addCustomStackResources;
