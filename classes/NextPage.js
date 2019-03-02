const path = require("path");

class NextPage {
  constructor(pagePath) {
    this.pagePath = pagePath;

    if (!this.pageDir.endsWith("/serverless/pages")) {
      throw new Error(`Invalid next page directory: ${pagePath}`);
    }
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

  get serverlessFunction() {
    return {
      handler: this.pageHandler,
      events: [
        {
          http: {
            path: this.pageName,
            method: "get"
          }
        }
      ]
    };
  }
}

module.exports = NextPage;
