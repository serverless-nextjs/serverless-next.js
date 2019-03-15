const path = require("path");
const merge = require("lodash.merge");

class NextPage {
  constructor(pagePath, serverlessFunctionOverrides) {
    this.pagePath = pagePath;
    this.serverlessFunctionOverrides = serverlessFunctionOverrides;
  }

  get pageOriginalPath() {
    return path.join(this.pageDir, `${this.pageName}.original.js`);
  }

  get pageCompatPath() {
    return path.join(this.pageDir, `${this.pageName}.compat.js`);
  }

  get pageDir() {
    return path.dirname(this.pagePath);
  }

  get pageName() {
    return path.basename(this.pagePath, ".js");
  }

  get pageHandler() {
    const dir = path.dirname(this.pagePath);
    return path.join(dir, this.pageName + ".render");
  }

  get functionName() {
    return this.pageName + "Page";
  }

  get serverlessFunction() {
    const configuration = {
      handler: this.pageHandler,
      events: [
        {
          http: {
            path: this.pageName === "index" ? "/" : this.pageName,
            method: "get"
          }
        }
      ]
    };

    if (this.serverlessFunctionOverrides) {
      delete this.serverlessFunctionOverrides.handler;
      delete this.serverlessFunctionOverrides.runtime;

      merge(configuration, this.serverlessFunctionOverrides || {});
    }

    return {
      [this.functionName]: configuration
    };
  }
}

module.exports = NextPage;
