const path = require("path");

class NextPage {
  constructor(pagePath) {
    this.pagePath = pagePath;
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
    return {
      [this.functionName]: {
        handler: this.pageHandler,
        events: [
          {
            http: {
              path: this.pageName === "index" ? "/" : this.pageName,
              method: "get"
            }
          }
        ]
      }
    };
  }
}

module.exports = NextPage;
