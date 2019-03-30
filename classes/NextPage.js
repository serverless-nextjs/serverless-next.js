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
    if (this.pageName === "_error") {
      return "notFoundErrorPage";
    }

    return this.pageName + "Page";
  }

  get pageRoute() {
    const pathSegments = this.pagePath.split(path.sep);

    switch (this.pageName) {
      case "index":
        return "/";
      case "_error":
        return "/{proxy+}";
      default:
        // handle pages at any subdir level
        // e.g. build/post.js
        //      build/categories/post.js
        //      build/categories/fridge/index.js
        return pathSegments
          .slice(1, pathSegments.length - 1)
          .concat([this.pageName])
          .join("/");
    }
  }

  get serverlessFunction() {
    const configuration = {
      handler: this.pageHandler,
      events: [
        {
          http: {
            path: this.pageRoute,
            method: "get"
          }
        }
      ]
    };

    if (this.serverlessFunctionOverrides) {
      delete this.serverlessFunctionOverrides.handler;
      delete this.serverlessFunctionOverrides.runtime;

      merge(configuration, this.serverlessFunctionOverrides);
    }

    return {
      [this.functionName]: configuration
    };
  }
}

module.exports = NextPage;
