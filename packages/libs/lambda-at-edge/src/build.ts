import nodeFileTrace, { NodeFileTraceReasons } from "@zeit/node-file-trace";
import execa from "execa";
import fse from "fs-extra";
import { join } from "path";
import getAllFiles from "./lib/getAllFilesInDirectory";
import path from "path";
import { getSortedRoutes } from "./lib/sortedRoutes";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest
} from "../types";
import isDynamicRoute from "./lib/isDynamicRoute";
import pathToPosix from "./lib/pathToPosix";
import expressifyDynamicRoute from "./lib/expressifyDynamicRoute";
import pathToRegexStr from "./lib/pathToRegexStr";
import normalizeNodeModules from "./lib/normalizeNodeModules";
import createServerlessConfig from "./lib/createServerlessConfig";

export const DEFAULT_LAMBDA_CODE_DIR = "default-lambda";
export const API_LAMBDA_CODE_DIR = "api-lambda";

type BuildOptions = {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cmd?: string;
  useServerlessTraceTarget?: boolean;
};

const defaultBuildOptions = {
  args: [],
  cwd: process.cwd(),
  env: {},
  cmd: "./node_modules/.bin/next",
  useServerlessTraceTarget: false
};

class Builder {
  nextConfigDir: string;
  dotNextDir: string;
  serverlessDir: string;
  outputDir: string;
  buildOptions: BuildOptions = defaultBuildOptions;

  constructor(
    nextConfigDir: string,
    outputDir: string,
    buildOptions?: BuildOptions
  ) {
    this.nextConfigDir = path.resolve(nextConfigDir);
    this.dotNextDir = path.join(this.nextConfigDir, ".next");
    this.serverlessDir = path.join(this.dotNextDir, "serverless");
    this.outputDir = outputDir;
    if (buildOptions) {
      this.buildOptions = buildOptions;
    }
  }

  async readPublicFiles(): Promise<string[]> {
    const dirExists = await fse.pathExists(join(this.nextConfigDir, "public"));
    if (dirExists) {
      return getAllFiles(join(this.nextConfigDir, "public"))
        .map((e) => e.replace(this.nextConfigDir, ""))
        .map((e) => e.split(path.sep).slice(2).join("/"));
    } else {
      return [];
    }
  }

  async readPagesManifest(): Promise<{ [key: string]: string }> {
    const path = join(this.serverlessDir, "pages-manifest.json");
    const hasServerlessPageManifest = await fse.pathExists(path);

    if (!hasServerlessPageManifest) {
      return Promise.reject(
        "pages-manifest not found. Check if `next.config.js` target is set to 'serverless'"
      );
    }

    const pagesManifest = await fse.readJSON(path);
    const pagesManifestWithoutDynamicRoutes = Object.keys(pagesManifest).reduce(
      (acc: { [key: string]: string }, route: string) => {
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

    sortedDynamicRoutedPages.forEach((route) => {
      sortedPagesManifest[route] = pagesManifest[route];
    });

    return sortedPagesManifest;
  }

  copyLambdaHandlerDependencies(
    fileList: string[],
    reasons: NodeFileTraceReasons,
    handlerDirectory: string
  ): Promise<void>[] {
    return fileList
      .filter((file) => {
        // exclude "initial" files from lambda artefact. These are just the pages themselves
        // which are copied over separately
        return !reasons[file] || reasons[file].type !== "initial";
      })
      .map((filePath: string) => {
        const resolvedFilePath = path.resolve(filePath);
        const dst = normalizeNodeModules(
          path.relative(this.serverlessDir, resolvedFilePath)
        );

        return fse.copy(
          resolvedFilePath,
          join(this.outputDir, handlerDirectory, dst)
        );
      });
  }

  async buildDefaultLambda(
    buildManifest: OriginRequestDefaultHandlerManifest
  ): Promise<void[]> {
    let copyTraces: Promise<void>[] = [];

    if (this.buildOptions.useServerlessTraceTarget) {
      const ignoreAppAndDocumentPages = (page: string): boolean => {
        const basename = path.basename(page);
        return basename !== "_app.js" && basename !== "_document.js";
      };

      const allSsrPages = [
        ...Object.values(buildManifest.pages.ssr.nonDynamic),
        ...Object.values(buildManifest.pages.ssr.dynamic).map(
          (entry) => entry.file
        )
      ].filter(ignoreAppAndDocumentPages);

      const ssrPages = Object.values(allSsrPages).map((pageFile) =>
        path.join(this.serverlessDir, pageFile)
      );

      const { fileList, reasons } = await nodeFileTrace(ssrPages, {
        base: process.cwd()
      });

      copyTraces = this.copyLambdaHandlerDependencies(
        fileList,
        reasons,
        DEFAULT_LAMBDA_CODE_DIR
      );
    }

    return Promise.all([
      ...copyTraces,
      fse.copy(
        require.resolve("@sls-next/lambda-at-edge/dist/default-handler.js"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "index.js")
      ),
      fse.writeJson(
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      fse.copy(
        require.resolve("@sls-next/next-aws-cloudfront"),
        join(
          this.outputDir,
          DEFAULT_LAMBDA_CODE_DIR,
          "node_modules/@sls-next/next-aws-cloudfront/index.js"
        )
      ),
      fse.copy(
        join(this.serverlessDir, "pages"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "pages"),
        {
          filter: (file: string) => {
            const isNotPrerenderedHTMLPage = path.extname(file) !== ".html";
            const isNotStaticPropsJSONFile = path.extname(file) !== ".json";
            const isNotApiPage = pathToPosix(file).indexOf("pages/api") === -1;

            return (
              isNotApiPage &&
              isNotPrerenderedHTMLPage &&
              isNotStaticPropsJSONFile
            );
          }
        }
      ),
      fse.copy(
        join(this.dotNextDir, "prerender-manifest.json"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "prerender-manifest.json")
      ),
      fse.copy(
        join(this.dotNextDir, "routes-manifest.json"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "routes-manifest.json")
      )
    ]);
  }

  async buildApiLambda(
    apiBuildManifest: OriginRequestApiHandlerManifest
  ): Promise<void[]> {
    let copyTraces: Promise<void>[] = [];

    if (this.buildOptions.useServerlessTraceTarget) {
      const allApiPages = [
        ...Object.values(apiBuildManifest.apis.nonDynamic),
        ...Object.values(apiBuildManifest.apis.dynamic).map(
          (entry) => entry.file
        )
      ];

      const apiPages = Object.values(allApiPages).map((pageFile) =>
        path.join(this.serverlessDir, pageFile)
      );

      const { fileList, reasons } = await nodeFileTrace(apiPages, {
        base: process.cwd()
      });

      copyTraces = this.copyLambdaHandlerDependencies(
        fileList,
        reasons,
        API_LAMBDA_CODE_DIR
      );
    }

    return Promise.all([
      ...copyTraces,
      fse.copy(
        require.resolve("@sls-next/lambda-at-edge/dist/api-handler.js"),
        join(this.outputDir, API_LAMBDA_CODE_DIR, "index.js")
      ),
      fse.copy(
        require.resolve("@sls-next/next-aws-cloudfront"),
        join(
          this.outputDir,
          API_LAMBDA_CODE_DIR,
          "node_modules/@sls-next/next-aws-cloudfront/index.js"
        )
      ),
      fse.copy(
        join(this.serverlessDir, "pages/api"),
        join(this.outputDir, API_LAMBDA_CODE_DIR, "pages/api")
      ),
      fse.writeJson(
        join(this.outputDir, API_LAMBDA_CODE_DIR, "manifest.json"),
        apiBuildManifest
      ),
      fse.copy(
        join(this.dotNextDir, "routes-manifest.json"),
        join(this.outputDir, API_LAMBDA_CODE_DIR, "routes-manifest.json")
      )
    ]);
  }

  async prepareBuildManifests(): Promise<{
    defaultBuildManifest: OriginRequestDefaultHandlerManifest;
    apiBuildManifest: OriginRequestApiHandlerManifest;
  }> {
    const pagesManifest = await this.readPagesManifest();

    const buildId = await fse.readFile(
      path.join(this.dotNextDir, "BUILD_ID"),
      "utf-8"
    );
    const defaultBuildManifest: OriginRequestDefaultHandlerManifest = {
      buildId,
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
      publicFiles: {}
    };

    const apiBuildManifest: OriginRequestApiHandlerManifest = {
      apis: {
        dynamic: {},
        nonDynamic: {}
      }
    };

    const ssrPages = defaultBuildManifest.pages.ssr;
    const htmlPages = defaultBuildManifest.pages.html;
    const apiPages = apiBuildManifest.apis;

    const isHtmlPage = (path: string): boolean => path.endsWith(".html");
    const isApiPage = (path: string): boolean => path.startsWith("pages/api");

    Object.entries(pagesManifest).forEach(([route, pageFile]) => {
      const dynamicRoute = isDynamicRoute(route);
      const expressRoute = dynamicRoute ? expressifyDynamicRoute(route) : null;

      if (isHtmlPage(pageFile)) {
        if (dynamicRoute) {
          const route = expressRoute as string;
          htmlPages.dynamic[route] = {
            file: pageFile,
            regex: pathToRegexStr(route)
          };
        } else {
          htmlPages.nonDynamic[route] = pageFile;
        }
      } else if (isApiPage(pageFile)) {
        if (dynamicRoute) {
          const route = expressRoute as string;
          apiPages.dynamic[route] = {
            file: pageFile,
            regex: pathToRegexStr(route)
          };
        } else {
          apiPages.nonDynamic[route] = pageFile;
        }
      } else if (dynamicRoute) {
        const route = expressRoute as string;
        ssrPages.dynamic[route] = {
          file: pageFile,
          regex: pathToRegexStr(route)
        };
      } else {
        ssrPages.nonDynamic[route] = pageFile;
      }
    });

    const publicFiles = await this.readPublicFiles();

    publicFiles.forEach((pf) => {
      defaultBuildManifest.publicFiles["/" + pf] = pf;
    });

    return {
      defaultBuildManifest,
      apiBuildManifest
    };
  }

  async cleanupDotNext(): Promise<void> {
    const exists = await fse.pathExists(this.dotNextDir);

    if (exists) {
      const fileItems = await fse.readdir(this.dotNextDir);

      await Promise.all(
        fileItems
          .filter(
            (fileItem) => fileItem !== "cache" // avoid deleting the cache folder as that leads to slow next builds!
          )
          .map((fileItem) => fse.remove(join(this.dotNextDir, fileItem)))
      );
    }
  }

  async build(debugMode: boolean): Promise<void> {
    const { cmd, args, cwd, env, useServerlessTraceTarget } = Object.assign(
      defaultBuildOptions,
      this.buildOptions
    );

    await this.cleanupDotNext();

    await fse.emptyDir(join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR));
    await fse.emptyDir(join(this.outputDir, API_LAMBDA_CODE_DIR));

    const { restoreUserConfig } = await createServerlessConfig(
      cwd,
      path.join(this.nextConfigDir),
      useServerlessTraceTarget
    );

    try {
      const subprocess = execa(cmd, args, {
        cwd,
        env
      });

      if (debugMode) {
        // @ts-ignore
        subprocess.stdout.pipe(process.stdout);
      }

      await subprocess;
    } finally {
      await restoreUserConfig();
    }

    const {
      defaultBuildManifest,
      apiBuildManifest
    } = await this.prepareBuildManifests();

    await this.buildDefaultLambda(defaultBuildManifest);

    const hasAPIPages =
      Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
      Object.keys(apiBuildManifest.apis.dynamic).length > 0;

    if (hasAPIPages) {
      await this.buildApiLambda(apiBuildManifest);
    }
  }
}

export default Builder;
