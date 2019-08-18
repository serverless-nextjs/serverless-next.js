const { Component } = require("@serverless/core");
const nextBuild = require("next/dist/build").default;
const fse = require("fs-extra");
const path = require("path");
const url = require("url");
const isDynamicRoute = require("./lib/isDynamicRoute");
const expressifyDynamicRoute = require("./lib/expressifyDynamicRoute");
const pathToRegexStr = require("./lib/pathToRegexStr");

class NextjsComponent extends Component {
  async default(inputs = {}) {
    return this.build();
  }

  readPublicFiles() {
    return fse.readdir("./public");
  }

  readPagesManifest() {
    return fse.readJSON("./.next/serverless/pages/pages-manifest.json");
  }

  writeBuildManifest(newManifest) {
    return fse.writeJson("./serverless-nextjs-tmp/manifest.json", newManifest);
  }
  // do not confuse the component build manifest with nextjs pages manifest!
  // they have different formats and data
  getBlankBuildManifest() {
    return {
      pages: {
        ssr: {
          dynamic: {},
          nonDynamic: {}
        },
        html: {}
      },
      publicFiles: {},
      cloudFrontOrigins: {
        ssrApi: {}
      }
    };
  }

  async copyPagesDirectory() {
    return fse.copy(".next/serverless/pages", "./serverless-nextjs-tmp/pages");
  }

  async build() {
    await nextBuild(path.resolve("./"));

    const pagesManifest = await this.readPagesManifest();
    const buildManifest = this.getBlankBuildManifest();

    const ssr = buildManifest.pages.ssr;
    const allRoutes = Object.keys(pagesManifest);

    allRoutes.forEach(r => {
      if (pagesManifest[r].endsWith(".html")) {
        buildManifest.pages.html[r] = pagesManifest[r];
      } else if (isDynamicRoute(r)) {
        const expressRoute = expressifyDynamicRoute(r);
        ssr.dynamic[expressRoute] = {
          file: pagesManifest[r],
          regex: pathToRegexStr(expressRoute)
        };
      } else {
        ssr.nonDynamic[r] = pagesManifest[r];
      }
    });

    const publicFiles = await this.readPublicFiles();

    publicFiles.forEach(pf => {
      buildManifest.publicFiles["/" + pf] = pf;
    });

    const backend = await this.load("@serverless/backend");

    const backendOutputs = await backend({
      code: {
        src: "./serverless-nextjs-tmp"
      }
    });

    buildManifest.cloudFrontOrigins.ssrApi = {
      domainName: url.parse(backendOutputs.url).host
    };

    await fse.emptyDir("./serverless-nextjs-tmp");

    await this.writeBuildManifest(buildManifest);
    await this.copyPagesDirectory();
  }
}

module.exports = NextjsComponent;
