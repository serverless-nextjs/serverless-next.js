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

    this.provider = this.serverless.getProvider("aws");
    this.providerRequest = this.provider.request.bind(this.provider);
    this.pluginBuildDir = new PluginBuildDir(this.nextConfigDir);

    this.addCustomStackResources = addCustomStackResources.bind(this);
    this.uploadStaticAssets = uploadStaticAssets.bind(this);
    this.build = build.bind(this);
    this.checkForChanges = checkForChanges.bind(this);

    this.printStackOutput = this.printStackOutput.bind(this);
    this.removePluginBuildDir = this.removePluginBuildDir.bind(this);

    this.hooks = {
      "before:offline:start": this.build,
      "before:package:initialize": this.build,
      "before:deploy:function:initialize": this.build,
      "before:aws:package:finalize:mergeCustomProviderResources": this
        .addCustomStackResources,
      "after:package:createDeploymentArtifacts": this.removePluginBuildDir,
      "after:aws:deploy:deploy:checkForChanges": this.checkForChanges,
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
    const defaults = {
      routes: [],
      nextConfigDir: "./",
      uploadBuildAssets: true,
      cloudFront: false,
      createAssetBucket: true
    };

    const userConfig = this.serverless.service.custom["serverless-nextjs"][
      param
    ];

    return userConfig === undefined ? defaults[param] : userConfig;
  }

  getPluginConfigValues(...params) {
    return params.map(p => this.getPluginConfigValue(p));
  }

  printStackOutput() {
    const awsInfo = this.serverless.pluginManager.getPlugins().find(plugin => {
      return plugin.constructor.name === "AwsInfo";
    });

    return displayServiceInfo(awsInfo);
  }

  removePluginBuildDir() {
    return this.pluginBuildDir.removeBuildDir();
  }
}

module.exports = ServerlessNextJsPlugin;
