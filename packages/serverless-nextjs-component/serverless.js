const { Component } = require("@serverless/core");
const fse = require("fs-extra");
const path = require("path");
const execa = require("execa");

const isDynamicRoute = require("./lib/isDynamicRoute");
const obtainDomains = require("./lib/obtainDomains");
const expressifyDynamicRoute = require("./lib/expressifyDynamicRoute");
const pathToRegexStr = require("./lib/pathToRegexStr");
const { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } = require("./constants");
const getSortedRoutes = require("./lib/sortedRoutes");
const getAllFiles = require("./lib/getAllFiles");

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
    if (dirExists) {
      return getAllFiles(join(nextConfigPath, "public"))
        .map(e => e.replace(nextConfigPath, ""))
        .map(e =>
          e
            .split(path.sep)
            .slice(2)
            .join("/")
        );
    } else {
      return [];
    }
  }

  async readPagesManifest(nextConfigPath) {
    const path = join(nextConfigPath, ".next/serverless/pages-manifest.json");
    const hasServerlessPageManifest = await fse.exists(path);

    if (!hasServerlessPageManifest) {
      return Promise.reject(
        "pages-manifest not found. Check if `next.config.js` target is set to 'serverless'"
      );
    }

    const pagesManifest = await fse.readJSON(path);
    const pagesManifestWithoutDynamicRoutes = Object.keys(pagesManifest).reduce(
      (acc, route) => {
        if (isDynamicRoute(route)) {
          return acc;
        }

        acc[route] = pagesManifest[route];
        return acc;
      },
      {}
    );

    const dynamicRoutedPages = Object.keys(pagesManifest).filter(
      isDynamicRoute
    );
    const sortedDynamicRoutedPages = getSortedRoutes(dynamicRoutedPages);

    const sortedPagesManifest = pagesManifestWithoutDynamicRoutes;

    sortedDynamicRoutedPages.forEach(route => {
      sortedPagesManifest[route] = pagesManifest[route];
    });

    return sortedPagesManifest;
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
        html: {
          dynamic: {},
          nonDynamic: {}
        }
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
    const htmlPages = defaultBuildManifest.pages.html;
    const apiPages = apiBuildManifest.apis;

    const isHtmlPage = p => p.endsWith(".html");
    const isApiPage = p => p.startsWith("pages/api");

    Object.entries(pagesManifest).forEach(([route, pageFile]) => {
      const dynamicRoute = isDynamicRoute(route);
      const expressRoute = dynamicRoute ? expressifyDynamicRoute(route) : null;

      if (isHtmlPage(pageFile)) {
        if (dynamicRoute) {
          htmlPages.dynamic[expressRoute] = {
            file: pageFile,
            regex: pathToRegexStr(expressRoute)
          };
        } else {
          htmlPages.nonDynamic[route] = pageFile;
        }
      } else if (isApiPage(pageFile)) {
        if (dynamicRoute) {
          apiPages.dynamic[expressRoute] = {
            file: pageFile,
            regex: pathToRegexStr(expressRoute)
          };
        } else {
          apiPages.nonDynamic[route] = pageFile;
        }
      } else if (dynamicRoute) {
        ssrPages.dynamic[expressRoute] = {
          file: pageFile,
          regex: pathToRegexStr(expressRoute)
        };
      } else {
        ssrPages.nonDynamic[route] = pageFile;
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

    const buildConfig = {
      enabled: inputs.build
        ? inputs.build !== false && inputs.build.enabled !== false
        : true,
      cmd: "node_modules/.bin/next",
      args: ["build"],
      ...(typeof inputs.build === "object" ? inputs.build : {}),
      cwd:
        inputs.build && inputs.build.cwd
          ? path.resolve(inputs.build.cwd)
          : nextConfigPath
    };

    if (buildConfig.enabled) {
      let { cmd, args, cwd, env } = buildConfig;
      await execa(cmd, args, {
        cwd,
        env
      });
    }

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
    const nextStaticPath = inputs.nextStaticDir || "";
    const staticPath = nextStaticPath || nextConfigPath;

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

    const nonDynamicHtmlPages = Object.values(
      defaultBuildManifest.pages.html.nonDynamic
    );

    const dynamicHtmlPages = Object.values(
      defaultBuildManifest.pages.html.dynamic
    ).map(x => x.file);

    const uploadHtmlPages = [...nonDynamicHtmlPages, ...dynamicHtmlPages].map(
      page =>
        bucket.upload({
          file: join(nextConfigPath, ".next/serverless", page),
          key: `static-pages/${page.replace("pages/", "")}`
        })
    );

    const assetsUpload = [
      bucket.upload({
        dir: join(nextConfigPath, ".next/static"),
        keyPrefix: "_next/static",
        cacheControl: "public, max-age=31536000, immutable"
      }),
      ...uploadHtmlPages
    ];

    const [publicDirExists, staticDirExists] = await Promise.all([
      fse.exists(join(staticPath, "public")),
      fse.exists(join(staticPath, "static"))
    ]);

    if (publicDirExists) {
      assetsUpload.push(
        bucket.upload({
          dir: join(staticPath, "public"),
          keyPrefix: "public"
        })
      );
    }

    if (staticDirExists) {
      assetsUpload.push(
        bucket.upload({
          dir: join(staticPath, "static"),
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

    const getLambdaMemory = lambdaType =>
      typeof inputs.memory === "number"
        ? inputs.memory
        : (inputs.memory && inputs.memory[lambdaType]) || 512;

    const getLambdaTimeout = lambdaType =>
      typeof inputs.timeout === "number"
        ? inputs.timeout
        : (inputs.timeout && inputs.timeout[lambdaType]) || 10;

    if (hasAPIPages) {
      apiEdgeLambdaOutputs = await apiEdgeLambda({
        description: "API Lambda@Edge for Next CloudFront distribution",
        handler: "index.handler",
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
        role: {
          service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"],
          policy: {
            arn:
              inputs.policy ||
              "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
          }
        },
        memory: getLambdaMemory("apiLambda"),
        timeout: getLambdaTimeout("apiLambda")
      });

      apiEdgeLambdaPublishOutputs = await apiEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns["api/*"] = {
        ttl: 0,
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
          arn:
            inputs.policy ||
            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        }
      },
      memory: getLambdaMemory("defaultLambda"),
      timeout: getLambdaTimeout("defaultLambda")
    });

    const defaultEdgeLambdaPublishOutputs = await defaultEdgeLambda.publishVersion();

    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 0,
        allowedHttpMethods: ["HEAD", "GET"],
        forward: {
          cookies: "all",
          queryString: true
        },
        "lambda@edge": {
          "origin-request": `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`
        }
      },
      origins: cloudFrontOrigins
    });

    let appUrl = cloudFrontOutputs.url;

    // Create domain
    const { domain, subdomain } = obtainDomains(inputs.domain);
    if (domain) {
      const domainComponent = await this.load("@serverless/domain");
      const domainOutputs = await domainComponent({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: cloudFrontOutputs
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
