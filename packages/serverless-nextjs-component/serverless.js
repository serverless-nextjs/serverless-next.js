const { Component } = require("@serverless/core");
const fse = require("fs-extra");
const path = require("path");
const execa = require("execa");
const isDynamicRoute = require("./lib/isDynamicRoute");
const expressifyDynamicRoute = require("./lib/expressifyDynamicRoute");
const pathToRegexStr = require("./lib/pathToRegexStr");
const { LAMBDA_AT_EDGE_BUILD_DIR } = require("./constants");

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
      cloudFrontOrigins: {}
    };
  }

  buildLambdaAtEdge(buildManifest) {
    const copyPromises = [
      fse.copy(
        path.join(__dirname, "lambda-at-edge-handler.js"),
        `./${LAMBDA_AT_EDGE_BUILD_DIR}/index.js`
      ),
      fse.writeJson(
        `./${LAMBDA_AT_EDGE_BUILD_DIR}/manifest.json`,
        buildManifest
      ),
      fse.copy(
        path.join(__dirname, "next-aws-cloudfront.js"),
        `./${LAMBDA_AT_EDGE_BUILD_DIR}/next-aws-cloudfront.js`
      ),
      fse.copy(".next/serverless/pages", `./${LAMBDA_AT_EDGE_BUILD_DIR}/pages`),
      fse.copy(
        path.join(__dirname, "router.js"),
        `./${LAMBDA_AT_EDGE_BUILD_DIR}/router.js`
      )
    ];

    return Promise.all(copyPromises);
  }

  async build() {
    await execa("next", ["build"]);

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

    await fse.emptyDir(`./${LAMBDA_AT_EDGE_BUILD_DIR}`);

    const bucket = await this.load("@serverless/aws-s3");
    const cloudFront = await this.load("@serverless/aws-cloudfront");
    const lambda = await this.load("@serverless/aws-lambda");

    const bucketOutputs = await bucket({
      accelerated: true
    });

    const uploadHtmlPages = Object.values(buildManifest.pages.html).map(page =>
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

    buildManifest.cloudFrontOrigins = {
      staticOrigin: {
        domainName: `${bucketOutputs.name}.s3.amazonaws.com`
      }
    };

    await this.buildLambdaAtEdge(buildManifest);

    const lambdaAtEdgeOutputs = await lambda({
      description: "Lambda@Edge for Next CloudFront distribution",
      handler: "index.handler",
      code: `./${LAMBDA_AT_EDGE_BUILD_DIR}`,
      role: {
        service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
        policy: {
          arn: "arn:aws:iam::aws:policy/AdministratorAccess"
        }
      }
    });

    const lambdaPublishOutputs = await lambda.publishVersion();

    const bucketUrl = `http://${bucketOutputs.name}.s3.amazonaws.com`;

    const { url } = await cloudFront({
      defaults: {
        ttl: 5,
        allowedHttpMethods: [
          "HEAD",
          "DELETE",
          "POST",
          "GET",
          "OPTIONS",
          "PUT",
          "PATCH"
        ],
        "lambda@edge": {
          "origin-request": `${lambdaAtEdgeOutputs.arn}:${lambdaPublishOutputs.version}`
        }
      },
      origins: [
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
      ]
    });

    return {
      appUrl: url
    };
  }

  async remove() {
    const bucket = await this.load("@serverless/aws-s3");
    const lambda = await this.load("@serverless/aws-lambda");
    const cloudfront = await this.load("@serverless/aws-cloudfront");

    await bucket.remove();
    await lambda.remove();
    await cloudfront.remove();
  }
}

module.exports = NextjsComponent;
