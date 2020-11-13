"use strict";

const displayServiceInfo = require("./lib/displayServiceInfo");
const parseNextConfiguration = require("./lib/parseNextConfiguration");
const build = require("./lib/build");
const PluginBuildDir = require("./classes/PluginBuildDir");
const uploadStaticAssets = require("./lib/uploadStaticAssets");
const addCustomStackResources = require("./lib/addCustomStackResources");
const checkForChanges = require("./lib/checkForChanges");

class ServerlessNextJsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {};

    this.build = build.bind(this);
    this.addCustomStackResources = addCustomStackResources.bind(this);
    this.checkForChanges = checkForChanges.bind(this);
    this.uploadStaticAssets = uploadStaticAssets.bind(this);

    this.hooks = {
      "before:offline:start": this.hookWrapper.bind(this, this.build),
      "before:package:initialize": this.hookWrapper.bind(this, this.build),
      "before:deploy:function:initialize": this.hookWrapper.bind(
        this,
        this.build
      ),
      "before:aws:package:finalize:mergeCustomProviderResources": this.hookWrapper.bind(
        this,
        this.addCustomStackResources
      ),
      "after:package:createDeploymentArtifacts": this.hookWrapper.bind(
        this,
        this.removePluginBuildDir
      ),
      "after:aws:deploy:deploy:checkForChanges": this.hookWrapper.bind(
        this,
        this.checkForChanges
      ),
      "after:aws:deploy:deploy:uploadArtifacts": this.hookWrapper.bind(
        this,
        this.uploadStaticAssets
      ),
      "after:aws:info:displayStackOutputs": this.hookWrapper.bind(
        this,
        this.printStackOutput
      )
    };
  }

  async hookWrapper(lifecycleFunc) {
    this.initializeVariables();
    return await lifecycleFunc.call(this);
  }

  initializeVariables() {
    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);
    this.pluginBuildDir = new PluginBuildDir(this.nextConfigDir);
  }

  get nextConfigDir() {
    return this.getPluginConfigValue("nextConfigDir");
  }

  get configuration() {
    return parseNextConfiguration(this.nextConfigDir);
  }

  getPluginConfigValue(param) {
    const defaults = {
      routes: [],
      nextConfigDir: "./",
      uploadBuildAssets: true,
      cloudFront: false,
      createAssetBucket: true
    };

    const userConfig =
      this.serverless.service.custom &&
      this.serverless.service.custom["serverless-nextjs"] &&
      this.serverless.service.custom["serverless-nextjs"][param];

    return userConfig === undefined ? defaults[param] : userConfig;
  }

  getPluginConfigValues(...params) {
    return params.map((p) => this.getPluginConfigValue(p));
  }

  printStackOutput() {
    const awsInfo = this.serverless.pluginManager
      .getPlugins()
      .find((plugin) => {
        return plugin.constructor.name === "AwsInfo";
      });

    return displayServiceInfo(awsInfo);
  }

  removePluginBuildDir() {
    return this.pluginBuildDir.removeBuildDir();
  }
}

module.exports = ServerlessNextJsPlugin;
