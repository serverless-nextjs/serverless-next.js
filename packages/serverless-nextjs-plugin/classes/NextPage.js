const path = require("path");
const merge = require("lodash.merge");
const clone = require("lodash.clonedeep");
const toPosix = require("../utils/pathToPosix");
const PluginBuildDir = require("./PluginBuildDir");

class NextPage {
  constructor(pagePath, { serverlessFunctionOverrides, routes } = {}) {
    this.pagePath = pagePath;
    this.serverlessFunctionOverrides = serverlessFunctionOverrides;
    this.routes = routes;
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

  get pageId() {
    const pathSegments = this.pagePath.split(path.sep);

    // strip out the parent build directory from path
    // sls-next-build/foo/bar.js -> /foo/bar.js
    const relativePathSegments = pathSegments.slice(
      pathSegments.indexOf(PluginBuildDir.BUILD_DIR_NAME) + 1,
      pathSegments.length
    );

    // remove extension
    // foo/bar.js -> /foo/bar
    const parsed = path.parse(relativePathSegments.join(path.posix.sep));
    return path.posix.join(parsed.dir, parsed.name);
  }

  get pageName() {
    return path.basename(this.pagePath, ".js");
  }

  get pageHandler() {
    const dir = path.dirname(this.pagePath);
    const handler = path.join(dir, this.pageName + ".render");
    const posixHandler = toPosix(handler);
    return posixHandler;
  }

  get functionName() {
    if (this.pageId === "_error") {
      return "not-found";
    }

    return this.pageId
      .replace(new RegExp(path.posix.sep, "g"), "-")
      .replace(/^-/, "")
      .replace(/[^\w-]/g, "_");
  }

  get pageRoute() {
    switch (this.pageId) {
      case "index":
        return "/";
      case "_error":
        return "/{proxy+}";
      default:
        // handle pages at any subdir level
        // e.g. sls-next-build/post.js
        //      sls-next-build/categories/post.js
        //      sls-next-build/categories/fridge/index.js
        //      app/sls-next-build/index.js
        const pathSegments = this.pagePath.split(path.sep);
        const buildDirIndex = pathSegments.indexOf(
          PluginBuildDir.BUILD_DIR_NAME
        );

        const routeSegments = pathSegments
          .slice(buildDirIndex + 1, pathSegments.length - 1)
          .concat([this.pageName]);

        const originalPath = routeSegments.join("/");
        const pathWithReplacedBrackets = originalPath
          .replace(/\[/g, "{")
          .replace(/\]/g, "}");

        return pathWithReplacedBrackets;
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

    if (this.routes && this.routes.length > 0) {
      configuration.events = [];

      this.routes.forEach(r => {
        const httpEvent = this.getHttpEventForRoute(r);
        configuration.events.push(httpEvent);
      });
    }

    const httpHeadEvents = this.getMatchingHttpHeadEvents(
      configuration.events.filter(e => e.http.method === "get")
    );

    configuration.events = configuration.events.concat(httpHeadEvents);

    return {
      [this.functionName]: configuration
    };
  }

  getMatchingHttpHeadEvents(httpGetEvents) {
    return httpGetEvents.map(e => {
      const headEvent = clone(e);
      headEvent.http.method = "head";
      return headEvent;
    });
  }

  getHttpEventForRoute(route) {
    const httpEvent = {
      http: {
        method: "get",
        ...route
      }
    };

    return httpEvent;
  }
}

module.exports = NextPage;
