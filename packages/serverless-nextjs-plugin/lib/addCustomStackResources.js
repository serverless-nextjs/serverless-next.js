const path = require("path");
const merge = require("lodash.merge");
const clone = require("lodash.clonedeep");
const getAssetsBucketName = require("./getAssetsBucketName");
const logger = require("../utils/logger");
const loadYml = require("../utils/yml/load");
const fse = require("fs-extra");

const capitaliseFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);

// removes non-alphanumeric characters to adhere to AWS naming requirements
const normaliseResourceName = str => str.replace(/[^0-9a-zA-Z]/g, "");

// converts file path to a string which can be used in CF resource keys
// ./static/bar.js -> Bar
// ./static/foo/bar.js -> FooBar
const normaliseFilePathForCloudFrontResourceKey = filePath =>
  filePath
    .split(path.sep)
    .filter(s => s !== "." && s !== "..")
    .map(capitaliseFirstLetter)
    .join("");

const getNextRouteProxyResources = async function({
  bucketBaseUrl,
  bucketName
}) {
  const nextDir = "_next";
  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-next.yml")
  );

  let result = {};

  const bucketUrl = `${bucketBaseUrl}/${path.posix.join(
    bucketName,
    nextDir,
    "{proxy}"
  )}`;

  let resource = clone(baseResource);

  resource.resources.Resources.NextStaticAssetsProxyParentResource.Properties.PathPart = nextDir;
  resource.resources.Resources.NextStaticAssetsProxyMethod.Properties.Integration.Uri = bucketUrl;

  result = resource.resources.Resources;

  logger.log(`Proxying NextJS assets -> ${bucketUrl}`);

  return result;
};

const getStaticRouteProxyResources = async function({
  bucketBaseUrl,
  bucketName
}) {
  const staticDir = path.join(this.nextConfigDir, "static");

  if (!(await fse.pathExists(staticDir))) {
    return {};
  }

  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-static.yml")
  );

  let result = {};

  const bucketUrl = `${bucketBaseUrl}/${path.posix.join(
    bucketName,
    "static",
    "{proxy}"
  )}`;
  let resource = clone(baseResource);

  resource.resources.Resources.StaticAssetsProxyParentResource.Properties.PathPart = staticDir;
  resource.resources.Resources.StaticAssetsProxyMethod.Properties.Integration.Uri = bucketUrl;

  result = resource.resources.Resources;

  logger.log(`Proxying static files -> ${bucketUrl}`);

  return result;
};

const getPublicRouteProxyResources = async function({
  bucketBaseUrl,
  bucketName
}) {
  const publicDir = path.join(this.nextConfigDir, "public");

  if (!(await fse.pathExists(publicDir))) {
    return {};
  }

  const publicFiles = await fse.readdir(publicDir);

  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-proxy.yml")
  );

  const result = {
    Resources: {}
  };

  publicFiles.forEach(file => {
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

const addCustomStackResources = async function() {
  const region = this.provider.getRegion();
  const bucketName = getAssetsBucketName.call(this);

  if (bucketName === null) {
    return;
  }

  logger.log(`Found bucket "${bucketName}" from serverless.yml`);

  // see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html
  const bucketBaseUrl =
    region === "us-east-1"
      ? "https://s3.amazonaws.com"
      : `https://s3-${region}.amazonaws.com`;

  const resourceConfiguration = { bucketName, bucketBaseUrl };

  const staticResources = await getStaticRouteProxyResources.call(
    this,
    resourceConfiguration
  );
  const nextResources = await getNextRouteProxyResources.call(
    this,
    resourceConfiguration
  );
  const publicResources = await getPublicRouteProxyResources.call(
    this,
    resourceConfiguration
  );

  const proxyResources = {
    Resources: {
      ...staticResources,
      ...nextResources,
      ...publicResources
    }
  };

  let assetsBucketResource = await loadYml(
    path.join(__dirname, "../resources/assets-bucket.yml")
  );

  assetsBucketResource.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

  this.serverless.service.resources = this.serverless.service.resources || {
    Resources: {}
  };

  merge(
    this.serverless.service.provider.coreCloudFormationTemplate,
    assetsBucketResource
  );

  merge(
    this.serverless.service.resources,
    assetsBucketResource,
    proxyResources
  );
};

module.exports = addCustomStackResources;
