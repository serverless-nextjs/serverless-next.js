"use strict";

const path = require("path");
const displayStackOutput = require("./lib/displayStackOutput");
const parseNextConfiguration = require("./lib/parseNextConfiguration");
const build = require("./lib/build");
const PluginBuildDir = require("./classes/PluginBuildDir");
const addAssetsBucketForDeployment = require("./lib/addAssetsBucketForDeployment");
const uploadStaticAssets = require("./lib/uploadStaticAssets");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {};

    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);
    this.pluginBuildDir = new PluginBuildDir(this.nextConfigDir);

    this.addAssetsBucketForDeployment = addAssetsBucketForDeployment.bind(this);
    this.uploadStaticAssets = uploadStaticAssets.bind(this);
    this.printStackOutput = this.printStackOutput.bind(this);
    this.buildNextPages = this.buildNextPages.bind(this);
    this.removePluginBuildDir = this.removePluginBuildDir.bind(this);

    this.hooks = {
      "before:offline:start": this.buildNextPages,
      "before:package:initialize": this.buildNextPages,
      "before:deploy:function:initialize": this.buildNextPages,
      "before:package:createDeploymentArtifacts": this
        .addAssetsBucketForDeployment,
      "after:package:createDeploymentArtifacts": this.removePluginBuildDir,
      "after:aws:deploy:deploy:uploadArtifacts": this.uploadStaticAssets,
      "after:aws:info:displayStackOutputs": this.printStackOutput
    };
  }

  get nextConfigDir() {
    return this.getPluginConfigValue("nextConfigDir");
  }

  get configuration() {
    return parseNextConfiguration(this.nextConfigDir);
  }

  getPluginConfigValue(param) {
    return this.serverless.service.custom["serverless-nextjs"][param];
  }

  buildNextPages() {
    const pluginBuildDir = this.pluginBuildDir;
    const servicePackage = this.serverless.service.package;

    servicePackage.include = servicePackage.include || [];
    servicePackage.include.push(
      path.posix.join(pluginBuildDir.posixBuildDir, "**")
    );
    return build(pluginBuildDir, this.getPluginConfigValue("pageConfig")).then(
      nextPages => this.setNextPages(nextPages)
    );
  }

  setNextPages(nextPages) {
    const service = this.serverless.service;

    this.nextPages = nextPages;

    nextPages.forEach(page => {
      const functionName = page.functionName;
      service.functions[functionName] = page.serverlessFunction[functionName];
    });

    this.serverless.service.setFunctionNames();
  }

  printStackOutput() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayStackOutput(awsInfo);
  }

  removePluginBuildDir() {
    return this.pluginBuildDir.removeBuildDir();
  }
}

module.exports = ServerlessNextJsPlugin;
