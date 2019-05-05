const fse = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");
const merge = require("lodash.merge");
const clone = require("lodash.clonedeep");
const util = require("util");
const cfSchema = require("./cfSchema");
const getAssetsBucketName = require("./getAssetsBucketName");
const logger = require("../utils/logger");

const capitaliseFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);

const loadYml = async ymlRelativePath => {
  const fullPath = path.resolve(__dirname, ymlRelativePath);

  const ymlStr = await fse.readFile(fullPath, "utf-8");

  return yaml.safeLoad(ymlStr, {
    fullPath,
    schema: cfSchema
  });
};

const getStaticRouteProxyResources = async function(bucketName) {
  const staticDir = this.getPluginConfigValue("staticDir");
  const routes = this.getPluginConfigValue("routes");

  const baseResource = await loadYml("../api-gw-proxy.yml");
  const result = {};

  routes.forEach(r => {
    const { src, dest } = r;

    const resourceName = capitaliseFirstLetter(
      path.basename(src, path.extname(src))
    );
    const resource = clone(baseResource);

    resource.Resources.ProxyResource.Properties.PathPart = dest;
    resource.Resources.ProxyMethod.Properties.Integration.Uri = `https://s3.amazonaws.com/${path.posix.join(
      bucketName,
      src
    )}`;

    resource[`${resourceName}ProxyResource`] = resource.Resources.ProxyResource;
    delete resource.Resources.ProxyResource;

    resource[`${resourceName}ProxyMethod`] = resource.Resources.ProxyMethod;
    delete resource.Resources.ProxyMethod;

    merge(result, {
      Resources: { ...resource }
    });
  });

  return result;
};

const addCustomStackResources = async function() {
  const bucketName = getAssetsBucketName.call(this);

  if (bucketName === null) {
    return Promise.resolve();
  }

  let resources = await loadYml("../resources.yml");

  logger.log(`Found bucket "${bucketName}"`);

  resources.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

  merge(this.serverless.service.provider.coreCloudFormationTemplate, resources);

  const proxyResources = await getStaticRouteProxyResources.call(
    this,
    bucketName
  );

  merge(resources, proxyResources);

  this.serverless.service.resources = resources;
};

module.exports = addCustomStackResources;

// console.log(util.inspect(s3Resources, false, null, true /* enable colors */));
