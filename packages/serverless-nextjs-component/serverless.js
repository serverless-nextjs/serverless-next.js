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
    if (inputs.build !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
  }

  async readPublicFiles(nextConfigPath) {
    const dirExists = await fse.exists(join(nextConfigPath, "public"));
    return dirExists ? fse.readdir(join(nextConfigPath, "public")) : [];
  }

  readPagesManifest(nextConfigPath) {
    return fse.readJSON(
      join(nextConfigPath, ".next/serverless/pages-manifest.json")
    );
  }

  readDefaultBuildManifest(nextConfigPath) {
    return fse.readJSON(
      join(nextConfigPath, ".serverless_nextjs/default-lambda/manifest.json")
    );
  }

  async readApiBuildManifest(nextConfigPath) {
    const path = join(
      nextConfigPath,
      ".serverless_nextjs/api-lambda/manifest.json"
    );
    return (await fse.exists(path))
      ? fse.readJSON(path)
      : Promise.resolve(undefined);
  }

  async emptyBuildDirectory(nextConfigPath) {
    return Promise.all([
      emptyDir(join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR)),
      emptyDir(join(nextConfigPath, API_LAMBDA_CODE_DIR))
    ]);
  }

  async prepareBuildManifests(nextConfigPath) {
    const pagesManifest = await this.readPagesManifest(nextConfigPath);

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

    const publicFiles = await this.readPublicFiles(nextConfigPath);

    publicFiles.forEach(pf => {
      defaultBuildManifest.publicFiles["/" + pf] = pf;
    });

    return {
      defaultBuildManifest,
      apiBuildManifest
    };
  }

  buildDefaultLambda(nextConfigPath, buildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "default-lambda-handler.js"),
        join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR, "index.js")
      ),
      writeJson(
        join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR, "next-aws-cloudfront.js")
      ),
      copy(
        join(nextConfigPath, ".next/serverless/pages"),
        join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR, "pages"),
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

  async buildApiLambda(nextConfigPath, apiBuildManifest) {
    return Promise.all([
      copy(
        join(__dirname, "api-lambda-handler.js"),
        join(nextConfigPath, API_LAMBDA_CODE_DIR, "index.js")
      ),
      copy(
        join(__dirname, "next-aws-cloudfront.js"),
        join(nextConfigPath, API_LAMBDA_CODE_DIR, "next-aws-cloudfront.js")
      ),
      copy(
        join(nextConfigPath, ".next/serverless/pages/api"),
        join(nextConfigPath, API_LAMBDA_CODE_DIR, "pages/api")
      ),
      copy(
        join(nextConfigPath, ".next/serverless/pages/_error.js"),
        join(nextConfigPath, API_LAMBDA_CODE_DIR, "pages/_error.js")
      ),
      writeJson(
        join(nextConfigPath, API_LAMBDA_CODE_DIR, "manifest.json"),
        apiBuildManifest
      )
    ]);
  }

  async build(inputs = {}) {
    const nextConfigPath = inputs.nextConfigDir
      ? path.resolve(inputs.nextConfigDir)
      : process.cwd();

    await execa("node_modules/.bin/next", ["build"], {
      cwd: nextConfigPath
    });

    await this.emptyBuildDirectory(nextConfigPath);

    const {
      defaultBuildManifest,
      apiBuildManifest
    } = await this.prepareBuildManifests(nextConfigPath);

    await this.buildDefaultLambda(nextConfigPath, defaultBuildManifest);

    const hasAPIPages =
      Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
      Object.keys(apiBuildManifest.apis.dynamic).length > 0;

    if (hasAPIPages) {
      await this.buildApiLambda(nextConfigPath, apiBuildManifest);
    }
  }

  async deploy(inputs = {}) {
    const nextConfigPath = inputs.nextConfigDir
      ? path.resolve(inputs.nextConfigDir)
      : process.cwd();

    const [defaultBuildManifest, apiBuildManifest] = await Promise.all([
      this.readDefaultBuildManifest(nextConfigPath),
      this.readApiBuildManifest(nextConfigPath)
    ]);

    const [
      bucket,
      cloudFront,
      defaultEdgeLambda,
      apiEdgeLambda
    ] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@serverless/aws-cloudfront"),
      this.load("@serverless/aws-lambda", "defaultEdgeLambda"),
      this.load("@serverless/aws-lambda", "apiEdgeLambda")
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName
    });

    const uploadHtmlPages = Object.values(defaultBuildManifest.pages.html).map(
      page =>
        bucket.upload({
          file: join(nextConfigPath, ".next/serverless", page),
          key: `static-pages/${page.replace("pages/", "")}`
        })
    );

    const assetsUpload = [
      bucket.upload({
        dir: join(nextConfigPath, ".next/static"),
        keyPrefix: "_next/static"
      }),
      ...uploadHtmlPages
    ];

    const [publicDirExists, staticDirExists] = await Promise.all([
      fse.exists(join(nextConfigPath, "public")),
      fse.exists(join(nextConfigPath, "static"))
    ]);

    if (publicDirExists) {
      assetsUpload.push(
        bucket.upload({
          dir: join(nextConfigPath, "public"),
          keyPrefix: "public"
        })
      );
    }

    if (staticDirExists) {
      assetsUpload.push(
        bucket.upload({
          dir: join(nextConfigPath, "static"),
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
      apiBuildManifest &&
      (Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
        Object.keys(apiBuildManifest.apis.dynamic).length > 0);

    if (hasAPIPages) {
      apiEdgeLambdaOutputs = await apiEdgeLambda({
        description: "API Lambda@Edge for Next CloudFront distribution",
        handler: "index.handler",
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
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
      code: join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR),
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
    const [bucket, cloudfront, domain] = await Promise.all([
      this.load("@serverless/aws-s3"),
      this.load("@serverless/aws-cloudfront"),
      this.load("@serverless/domain")
    ]);

    await Promise.all([bucket.remove(), cloudfront.remove(), domain.remove()]);
  }
}

module.exports = NextjsComponent;
