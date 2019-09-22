const { Component } = require("@serverless/core");
const fse = require("fs-extra");
const path = require("path");
const execa = require("execa");

const isDynamicRoute = require("./lib/isDynamicRoute");
const expressifyDynamicRoute = require("./lib/expressifyDynamicRoute");
const pathToRegexStr = require("./lib/pathToRegexStr");
const { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } = require("./constants");

const copy = fse.copy;
const join = path.join;
const writeJson = fse.writeJson;
const emptyDir = fse.emptyDir;

const pathToPosix = path => path.replace(/\\/g, "/");

class NextjsComponent extends Component {
  async default(inputs = {}) {
    return this.build(inputs);
  }

  async readPublicFiles() {
    const dirExists = await fse.exists("./public");
    return dirExists ? fse.readdir("./public") : [];
  }

  readPagesManifest() {
    return fse.readJSON("./.next/serverless/pages-manifest.json");
  }

  async emptyBuildDirectory() {
    return Promise.all([
      emptyDir(`./${DEFAULT_LAMBDA_CODE_DIR}`),
      emptyDir(`./${API_LAMBDA_CODE_DIR}`)
    ]);
  }

  async prepareBuildManifests() {
    const pagesManifest = await this.readPagesManifest();

    const defaultBuildManifest = {
      pages: {
        ssr: {
          dynamic: {},
          nonDynamic: {}
        },
        html: {}
      },
      publicFiles: {},
      cloudFrontOrigins: {}
    };

    const apiBuildManifest = {
      apis: {
        dynamic: {},
        nonDynamic: {}
      }
    };

    const ssrPages = defaultBuildManifest.pages.ssr;

    Object.keys(pagesManifest).forEach(r => {
      const dynamicRoute = isDynamicRoute(r);
      const expressRoute = dynamicRoute ? expressifyDynamicRoute(r) : null;

      if (pagesManifest[r].endsWith(".html")) {
        defaultBuildManifest.pages.html[r] = pagesManifest[r];
      } else if (pagesManifest[r].startsWith("pages/api")) {
        if (dynamicRoute) {
          apiBuildManifest.apis.dynamic[expressRoute] = {
            file: pagesManifest[r],
            regex: pathToRegexStr(expressRoute)
          };
        } else {
          apiBuildManifest.apis.nonDynamic[r] = pagesManifest[r];
        }
      } else if (dynamicRoute) {
        ssrPages.dynamic[expressRoute] = {
          file: pagesManifest[r],
          regex: pathToRegexStr(expressRoute)
        };
      } else {
        ssrPages.nonDynamic[r] = pagesManifest[r];
      }
    });

    const publicFiles = await this.readPublicFiles();

    publicFiles.forEach(pf => {
      defaultBuildManifest.publicFiles["/" + pf] = pf;
    });

    return {
      defaultBuildManifest,
      apiBuildManifest
    };
  }

  buildDefaultLambda(buildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "default-lambda-handler.js"),
        `./${DEFAULT_LAMBDA_CODE_DIR}/index.js`
      ),
      writeJson(`./${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`, buildManifest),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        `./${DEFAULT_LAMBDA_CODE_DIR}/next-aws-cloudfront.js`
      ),
      copy(".next/serverless/pages", `./${DEFAULT_LAMBDA_CODE_DIR}/pages`, {
        // skip api pages from default lambda code
        filter: file => {
          const isHTMLPage = path.extname(file) === ".html";
          return pathToPosix(file).indexOf("pages/api") === -1 && !isHTMLPage;
        }
      })
    ]);
  }

  async buildApiLambda(apiBuildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "api-lambda-handler.js"),
        `./${API_LAMBDA_CODE_DIR}/index.js`
      ),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        `./${API_LAMBDA_CODE_DIR}/next-aws-cloudfront.js`
      ),
      copy(".next/serverless/pages/api", `./${API_LAMBDA_CODE_DIR}/pages/api`),
      copy(
        ".next/serverless/pages/_error.js",
        `./${API_LAMBDA_CODE_DIR}/pages/_error.js`
      ),
      writeJson(`./${API_LAMBDA_CODE_DIR}/manifest.json`, apiBuildManifest)
    ]);
  }

  async build(inputs) {
    await execa("./node_modules/.bin/next", ["build"]);

    await this.emptyBuildDirectory();

    const {
      defaultBuildManifest,
      apiBuildManifest
    } = await this.prepareBuildManifests();

    const bucket = await this.load("@serverless/aws-s3");
    const cloudFront = await this.load("@serverless/aws-cloudfront");
    const defaultEdgeLambda = await this.load(
      "@serverless/aws-lambda",
      "defaultEdgeLambda"
    );
    const apiEdgeLambda = await this.load(
      "@serverless/aws-lambda",
      "apiEdgeLambda"
    );

    const bucketOutputs = await bucket({
      accelerated: true
    });

    const uploadHtmlPages = Object.values(defaultBuildManifest.pages.html).map(
      page =>
        bucket.upload({
          file: `./.next/serverless/${page}`,
          key: `static-pages/${page.replace("pages/", "")}`
        })
    );

    const assetsUpload = [
      bucket.upload({
        dir: "./.next/static",
        keyPrefix: "_next/static"
      }),
      ...uploadHtmlPages
    ];

    if (await fse.exists("./public")) {
      assetsUpload.push(
        bucket.upload({
          dir: "./public",
          keyPrefix: "public"
        })
      );
    }

    if (await fse.exists("./static")) {
      assetsUpload.push(
        bucket.upload({
          dir: "./static",
          keyPrefix: "static"
        })
      );
    }

    await Promise.all(assetsUpload);

    defaultBuildManifest.cloudFrontOrigins = {
      staticOrigin: {
        domainName: `${bucketOutputs.name}.s3.amazonaws.com`
      }
    };

    await this.buildDefaultLambda(defaultBuildManifest);

    const bucketUrl = `http://${bucketOutputs.name}.s3.amazonaws.com`;
    const cloudFrontOrigins = [
      {
        url: bucketUrl,
        private: true,
        pathPatterns: {
          "_next/*": {
            ttl: 86400
          },
          "static/*": {
            ttl: 86400
          }
        }
      }
    ];

    let apiEdgeLambdaOutputs;
    let apiEdgeLambdaPublishOutputs;

    const hasAPIPages =
      Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
      Object.keys(apiBuildManifest.apis.dynamic).length > 0;

    if (hasAPIPages) {
      await this.buildApiLambda(apiBuildManifest);

      apiEdgeLambdaOutputs = await apiEdgeLambda({
        description: "API Lambda@Edge for Next CloudFront distribution",
        handler: "index.handler",
        code: `./${API_LAMBDA_CODE_DIR}`,
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn: "arn:aws:iam::aws:policy/AdministratorAccess"
          }
        }
      });

      apiEdgeLambdaPublishOutputs = await apiEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns["api/*"] = {
        ttl: 5,
        "lambda@edge": {
          "origin-request": `${apiEdgeLambdaOutputs.arn}:${apiEdgeLambdaPublishOutputs.version}`
        },
        allowedHttpMethods: [
          "HEAD",
          "DELETE",
          "POST",
          "GET",
          "OPTIONS",
          "PUT",
          "PATCH"
        ]
      };
    }

    const defaultEdgeLambdaOutputs = await defaultEdgeLambda({
      description: "Default Lambda@Edge for Next CloudFront distribution",
      handler: "index.handler",
      code: `./${DEFAULT_LAMBDA_CODE_DIR}`,
      role: {
        service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
        policy: {
          arn: "arn:aws:iam::aws:policy/AdministratorAccess"
        }
      }
    });

    const defaultEdgeLambdaPublishOutputs = await defaultEdgeLambda.publishVersion();

    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 5,
        allowedHttpMethods: ["HEAD", "GET"],
        "lambda@edge": {
          "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
        }
      },
      origins: cloudFrontOrigins
    });

    let appUrl = cloudFrontOutputs.url;

    if (inputs.domain instanceof Array) {
      const domain = await this.load("@serverless/domain");
      const domainOutputs = await domain({
        privateZone: false,
        domain: inputs.domain[1],
        subdomains: {
          [inputs.domain[0]]: cloudFrontOutputs
        }
      });

      appUrl = domainOutputs.domains[0];
    }

    return {
      appUrl
    };
  }

  async remove() {
    const bucket = await this.load("@serverless/aws-s3");
    const cloudfront = await this.load("@serverless/aws-cloudfront");
    const domain = await this.load("@serverless/domain");

    await bucket.remove();
    await cloudfront.remove();
    await domain.remove();
  }
}

module.exports = NextjsComponent;
