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

  async readPublicFiles(nextConfigDir) {
    const dirExists = await fse.exists(join(nextConfigDir, "public"));
    return dirExists ? fse.readdir(join(nextConfigDir, "public")) : [];
  }

  readPagesManifest(nextConfigDir) {
    return fse.readJSON(
      join(nextConfigDir, ".next/serverless/pages-manifest.json")
    );
  }

  async emptyBuildDirectory(nextConfigDir) {
    return Promise.all([
      emptyDir(join(nextConfigDir, DEFAULT_LAMBDA_CODE_DIR)),
      emptyDir(join(nextConfigDir, API_LAMBDA_CODE_DIR))
    ]);
  }

  async prepareBuildManifests(nextConfigDir) {
    const pagesManifest = await this.readPagesManifest(nextConfigDir);

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

    const publicFiles = await this.readPublicFiles(nextConfigDir);

    publicFiles.forEach(pf => {
      defaultBuildManifest.publicFiles["/" + pf] = pf;
    });

    return {
      defaultBuildManifest,
      apiBuildManifest
    };
  }

  buildDefaultLambda(nextConfigDir, buildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "default-lambda-handler.js"),
        join(nextConfigDir, DEFAULT_LAMBDA_CODE_DIR, "index.js")
      ),
      writeJson(
        join(nextConfigDir, DEFAULT_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        join(nextConfigDir, DEFAULT_LAMBDA_CODE_DIR, "next-aws-cloudfront.js")
      ),
      copy(
        join(nextConfigDir, ".next/serverless/pages"),
        join(nextConfigDir, DEFAULT_LAMBDA_CODE_DIR, "pages"),
        {
          // skip api pages from default lambda code
          filter: file => {
            const isHTMLPage = path.extname(file) === ".html";
            return pathToPosix(file).indexOf("pages/api") === -1 && !isHTMLPage;
          }
        }
      )
    ]);
  }

  async buildApiLambda(nextConfigDir, apiBuildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "api-lambda-handler.js"),
        join(nextConfigDir, API_LAMBDA_CODE_DIR, "index.js")
      ),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        join(nextConfigDir, API_LAMBDA_CODE_DIR, "next-aws-cloudfront.js")
      ),
      copy(
        join(nextConfigDir, ".next/serverless/pages/api"),
        join(nextConfigDir, API_LAMBDA_CODE_DIR, "pages/api")
      ),
      copy(
        join(nextConfigDir, ".next/serverless/pages/_error.js"),
        join(nextConfigDir, API_LAMBDA_CODE_DIR, "pages/_error.js")
      ),
      writeJson(
        join(nextConfigDir, API_LAMBDA_CODE_DIR, "manifest.json"),
        apiBuildManifest
      )
    ]);
  }

  async build(inputs) {
    inputs.nextConfigDir = inputs.nextConfigDir
      ? path.resolve(inputs.nextConfigDir)
      : process.cwd();

    if (
      !(await fse.exists(join(inputs.nextConfigDir, "node_modules/.bin/next")))
    ) {
      throw Error(
        `node modules not found in the directory ${inputs.nextConfigDir}`
      );
    }

    await execa("node_modules/.bin/next", ["build"], {
      cwd: inputs.nextConfigDir
    });

    await this.emptyBuildDirectory(inputs.nextConfigDir);

    const {
      defaultBuildManifest,
      apiBuildManifest
    } = await this.prepareBuildManifests(inputs.nextConfigDir);

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
      accelerated: true,
      name: inputs.bucketName
    });

    const uploadHtmlPages = Object.values(defaultBuildManifest.pages.html).map(
      page =>
        bucket.upload({
          file: join(inputs.nextConfigDir, ".next/serverless", page),
          key: `static-pages/${page.replace("pages/", "")}`
        })
    );

    const assetsUpload = [
      bucket.upload({
        dir: join(inputs.nextConfigDir, ".next/static"),
        keyPrefix: "_next/static"
      }),
      ...uploadHtmlPages
    ];

    if (await fse.exists(join(inputs.nextConfigDir, "public"))) {
      assetsUpload.push(
        bucket.upload({
          dir: join(inputs.nextConfigDir, "public"),
          keyPrefix: "public"
        })
      );
    }

    if (await fse.exists(join(inputs.nextConfigDir, "static"))) {
      assetsUpload.push(
        bucket.upload({
          dir: join(inputs.nextConfigDir, "static"),
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

    await this.buildDefaultLambda(inputs.nextConfigDir, defaultBuildManifest);

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
      await this.buildApiLambda(inputs.nextConfigDir, apiBuildManifest);

      apiEdgeLambdaOutputs = await apiEdgeLambda({
        description: "API Lambda@Edge for Next CloudFront distribution",
        handler: "index.handler",
        code: join(inputs.nextConfigDir, API_LAMBDA_CODE_DIR),
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
      code: join(inputs.nextConfigDir, DEFAULT_LAMBDA_CODE_DIR),
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
        cookies: "all",
        queryString: true,
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
      appUrl,
      bucketName: bucketOutputs.name
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
