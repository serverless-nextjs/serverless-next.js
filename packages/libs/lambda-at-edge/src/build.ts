import { nodeFileTrace, NodeFileTraceReasons } from "@vercel/nft";
import execa from "execa";
import fse from "fs-extra";
import { join } from "path";
import getAllFiles from "./lib/getAllFilesInDirectory";
import path from "path";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestApiHandlerManifest,
  RoutesManifest,
  OriginRequestImageHandlerManifest
} from "./types";
import pathToPosix from "./lib/pathToPosix";
import normalizeNodeModules from "./lib/normalizeNodeModules";
import createServerlessConfig from "./lib/createServerlessConfig";
import { isTrailingSlashRedirect } from "./routing/redirector";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { PrerenderManifest } from "next/dist/build";
import { Item } from "klaw";
import { Job } from "@vercel/nft/out/node-file-trace";
import { prepareBuildManifests } from "@sls-next/core";
import { NextConfig } from "@sls-next/core/dist/build";

export const DEFAULT_LAMBDA_CODE_DIR = "default-lambda";
export const API_LAMBDA_CODE_DIR = "api-lambda";
export const IMAGE_LAMBDA_CODE_DIR = "image-lambda";
export const REGENERATION_LAMBDA_CODE_DIR = "regeneration-lambda";
export const ASSETS_DIR = "assets";

type BuildOptions = {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cmd?: string;
  useServerlessTraceTarget?: boolean;
  logLambdaExecutionTimes?: boolean;
  domainRedirects?: { [key: string]: string };
  minifyHandlers?: boolean;
  enableHTTPCompression?: boolean;
  handler?: string;
  authentication?: { username: string; password: string } | undefined;
  resolve?: (
    id: string,
    parent: string,
    job: Job,
    cjsResolve: boolean
  ) => string | string[];
  baseDir?: string;
};

const defaultBuildOptions = {
  args: [],
  cwd: process.cwd(),
  env: {},
  cmd: "./node_modules/.bin/next",
  useServerlessTraceTarget: false,
  logLambdaExecutionTimes: false,
  domainRedirects: {},
  minifyHandlers: false,
  enableHTTPCompression: true,
  authentication: undefined,
  resolve: undefined,
  baseDir: process.cwd()
};

class Builder {
  nextConfigDir: string;
  nextStaticDir: string;
  dotNextDir: string;
  serverlessDir: string;
  outputDir: string;
  buildOptions: BuildOptions = defaultBuildOptions;

  constructor(
    nextConfigDir: string,
    outputDir: string,
    buildOptions?: BuildOptions,
    nextStaticDir?: string
  ) {
    this.nextConfigDir = path.resolve(nextConfigDir);
    this.nextStaticDir = path.resolve(nextStaticDir ?? nextConfigDir);
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

    return await fse.readJSON(path);
  }

  copyLambdaHandlerDependencies(
    fileList: string[],
    reasons: NodeFileTraceReasons,
    handlerDirectory: string,
    base: string
  ): Promise<void>[] {
    return fileList
      .filter((file) => {
        // exclude "initial" files from lambda artefact. These are just the pages themselves
        // which are copied over separately

        // For TypeScript apps, somehow nodeFileTrace will generate filelist with TS or TSX files, we need to exclude these files to be copied
        // as it ends up copying from same source to destination.
        if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          return false;
        }

        return (
          (!reasons[file] || reasons[file].type !== "initial") &&
          file !== "package.json"
        );
      })
      .map((filePath: string) => {
        const resolvedFilePath = path.resolve(join(base, filePath));
        const dst = normalizeNodeModules(
          path.relative(this.serverlessDir, resolvedFilePath)
        );

        if (resolvedFilePath !== join(this.outputDir, handlerDirectory, dst)) {
          // Only copy when source and destination are different
          return fse.copy(
            resolvedFilePath,
            join(this.outputDir, handlerDirectory, dst)
          );
        } else {
          return Promise.resolve();
        }
      });
  }

  /**
   * Check whether this .next/serverless/pages file is a JS file used only for prerendering at build time.
   * @param prerenderManifest
   * @param relativePageFile
   */
  isPrerenderedJSFile(
    prerenderManifest: any,
    relativePageFile: string
  ): boolean {
    if (path.extname(relativePageFile) === ".js") {
      // Page route is without .js extension
      let pageRoute = relativePageFile.slice(0, -3);

      // Prepend "/"
      pageRoute = pageRoute.startsWith("/") ? pageRoute : `/${pageRoute}`;

      // Normalise index route
      pageRoute = pageRoute === "/index" ? "/" : pageRoute;

      return (
        !!prerenderManifest.routes && !!prerenderManifest.routes[pageRoute]
      );
    }

    return false;
  }

  /**
   * Process and copy RoutesManifest.
   * @param source
   * @param destination
   */
  async processAndCopyRoutesManifest(source: string, destination: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const routesManifest = require(source) as RoutesManifest;

    // Remove default trailing slash redirects as they are already handled without regex matching.
    routesManifest.redirects = routesManifest.redirects.filter((redirect) => {
      return !isTrailingSlashRedirect(redirect, routesManifest.basePath);
    });

    await fse.writeFile(destination, JSON.stringify(routesManifest));
  }

  /**
   * Process and copy handler code. This allows minifying it before copying to Lambda package.
   * @param handlerType
   * @param destination
   * @param shouldMinify
   */
  async processAndCopyHandler(
    handlerType:
      | "api-handler"
      | "default-handler"
      | "image-handler"
      | "regeneration-handler",
    destination: string,
    shouldMinify: boolean
  ) {
    const source = path.dirname(
      require.resolve(
        `@sls-next/lambda-at-edge/dist/${handlerType}/${
          shouldMinify ? "minified" : "standard"
        }`
      )
    );

    await fse.copy(source, destination);
  }

  async copyTraces(
    buildManifest: OriginRequestDefaultHandlerManifest
  ): Promise<void> {
    let copyTraces: Promise<void>[] = [];

    if (this.buildOptions.useServerlessTraceTarget) {
      const ignoreAppAndDocumentPages = (page: string): boolean => {
        const basename = path.basename(page);
        return basename !== "_app.js" && basename !== "_document.js";
      };

      const allSsrPages = [
        ...Object.values(buildManifest.pages.ssr.nonDynamic),
        ...Object.values(buildManifest.pages.ssr.dynamic)
      ].filter(ignoreAppAndDocumentPages);

      const ssrPages = Object.values(allSsrPages).map((pageFile) =>
        path.join(this.serverlessDir, pageFile)
      );

      const base = this.buildOptions.baseDir || process.cwd();
      const { fileList, reasons } = await nodeFileTrace(ssrPages, {
        base,
        resolve: this.buildOptions.resolve
      });

      copyTraces = this.copyLambdaHandlerDependencies(
        fileList,
        reasons,
        DEFAULT_LAMBDA_CODE_DIR,
        base
      );
    }

    await Promise.all(copyTraces);
  }

  async buildDefaultLambda(
    buildManifest: OriginRequestDefaultHandlerManifest
  ): Promise<void[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prerenderManifest = require(join(
      this.dotNextDir,
      "prerender-manifest.json"
    ));

    const hasAPIRoutes = await fse.pathExists(
      join(this.serverlessDir, "pages/api")
    );

    return Promise.all([
      this.copyTraces(buildManifest),
      this.processAndCopyHandler(
        "default-handler",
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(
              this.outputDir,
              DEFAULT_LAMBDA_CODE_DIR,
              this.buildOptions.handler
            )
          )
        : Promise.resolve(),
      fse.writeJson(
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      fse.copy(
        join(this.serverlessDir, "pages"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "pages"),
        {
          filter: (file: string) => {
            const isNotPrerenderedHTMLPage = path.extname(file) !== ".html";
            const isNotStaticPropsJSONFile = path.extname(file) !== ".json";
            const isNotApiPage = pathToPosix(file).indexOf("pages/api") === -1;

            // If there are API routes, include all JS files.
            // If there are no API routes, exclude all JS files that used only for prerendering at build time.
            // We do this because if there are API routes, preview mode is possible which may use these JS files.
            // This is what Vercel does: https://github.com/vercel/next.js/discussions/15631#discussioncomment-44289
            // TODO: possibly optimize bundle further for those apps using API routes.
            const isNotExcludedJSFile =
              hasAPIRoutes ||
              !this.isPrerenderedJSFile(
                prerenderManifest,
                path.relative(join(this.serverlessDir, "pages"), file)
              );

            return (
              isNotApiPage &&
              isNotPrerenderedHTMLPage &&
              isNotStaticPropsJSONFile &&
              isNotExcludedJSFile
            );
          }
        }
      ),
      this.copyChunks(DEFAULT_LAMBDA_CODE_DIR),
      fse.copy(
        join(this.dotNextDir, "prerender-manifest.json"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "prerender-manifest.json")
      ),
      this.processAndCopyRoutesManifest(
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

      const base = this.buildOptions.baseDir || process.cwd();
      const { fileList, reasons } = await nodeFileTrace(apiPages, {
        base,
        resolve: this.buildOptions.resolve
      });

      copyTraces = this.copyLambdaHandlerDependencies(
        fileList,
        reasons,
        API_LAMBDA_CODE_DIR,
        base
      );
    }

    return Promise.all([
      ...copyTraces,
      this.processAndCopyHandler(
        "api-handler",
        join(this.outputDir, API_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(this.outputDir, API_LAMBDA_CODE_DIR, this.buildOptions.handler)
          )
        : Promise.resolve(),
      fse.copy(
        join(this.serverlessDir, "pages/api"),
        join(this.outputDir, API_LAMBDA_CODE_DIR, "pages/api")
      ),
      this.copyChunks(API_LAMBDA_CODE_DIR),
      fse.writeJson(
        join(this.outputDir, API_LAMBDA_CODE_DIR, "manifest.json"),
        apiBuildManifest
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, "routes-manifest.json"),
        join(this.outputDir, API_LAMBDA_CODE_DIR, "routes-manifest.json")
      )
    ]);
  }

  async buildRegenerationHandler(
    buildManifest: OriginRequestDefaultHandlerManifest
  ): Promise<void> {
    await Promise.all([
      this.copyTraces(buildManifest),
      fse.writeJson(
        join(this.outputDir, REGENERATION_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      this.processAndCopyHandler(
        "regeneration-handler",
        join(this.outputDir, REGENERATION_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers
      ),
      this.copyChunks(REGENERATION_LAMBDA_CODE_DIR),
      fse.copy(
        join(this.serverlessDir, "pages"),
        join(this.outputDir, REGENERATION_LAMBDA_CODE_DIR, "pages"),
        {
          filter: (file: string) => {
            const isNotPrerenderedHTMLPage = path.extname(file) !== ".html";
            const isNotStaticPropsJSONFile = path.extname(file) !== ".json";
            const isNotApiPage = pathToPosix(file).indexOf("pages/api") === -1;

            return (
              isNotPrerenderedHTMLPage &&
              isNotStaticPropsJSONFile &&
              isNotApiPage
            );
          }
        }
      )
    ]);
  }

  /**
   * copy chunks if present and not using serverless trace
   */
  async copyChunks(buildDir: string): Promise<void> {
    return !this.buildOptions.useServerlessTraceTarget &&
      fse.existsSync(join(this.serverlessDir, "chunks"))
      ? fse.copy(
          join(this.serverlessDir, "chunks"),
          join(this.outputDir, buildDir, "chunks")
        )
      : Promise.resolve();
  }

  /**
   * Build image optimization lambda (supported by Next.js 10)
   * @param buildManifest
   */
  async buildImageLambda(
    buildManifest: OriginRequestImageHandlerManifest
  ): Promise<void[]> {
    return Promise.all([
      this.processAndCopyHandler(
        "image-handler",
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(
              this.outputDir,
              IMAGE_LAMBDA_CODE_DIR,
              this.buildOptions.handler
            )
          )
        : Promise.resolve(),
      fse.writeJson(
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, "manifest.json"),
        buildManifest
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, "routes-manifest.json"),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, "routes-manifest.json")
      ),
      fse.copy(
        join(
          path.dirname(
            require.resolve("@sls-next/lambda-at-edge/package.json")
          ),
          "dist",
          "sharp_node_modules"
        ),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, "node_modules")
      ),
      fse.copy(
        join(this.dotNextDir, "images-manifest.json"),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, "images-manifest.json")
      )
    ]);
  }

  async readNextConfig(): Promise<NextConfig | undefined> {
    const nextConfigPath = path.join(this.nextConfigDir, "next.config.js");

    if (await fse.pathExists(nextConfigPath)) {
      const nextConfig = await require(nextConfigPath);

      let normalisedNextConfig;
      if (typeof nextConfig === "object") {
        normalisedNextConfig = nextConfig;
      } else if (typeof nextConfig === "function") {
        // Execute using phase based on: https://github.com/vercel/next.js/blob/8a489e24bcb6141ad706e1527b77f3ff38940b6d/packages/next/next-server/lib/constants.ts#L1-L4
        normalisedNextConfig = nextConfig("phase-production-server", {});
      }
      return normalisedNextConfig;
    }
  }

  /**
   * Build static assets such as client-side JS, public files, static pages, etc.
   * Note that the upload to S3 is done in a separate deploy step.
   */
  async buildStaticAssets(
    defaultBuildManifest: OriginRequestDefaultHandlerManifest,
    routesManifest: RoutesManifest
  ) {
    const buildId = defaultBuildManifest.buildId;
    const basePath = routesManifest.basePath;
    const nextConfigDir = this.nextConfigDir;
    const nextStaticDir = this.nextStaticDir;

    const dotNextDirectory = path.join(this.nextConfigDir, ".next");

    const assetOutputDirectory = path.join(this.outputDir, ASSETS_DIR);

    const normalizedBasePath = basePath ? basePath.slice(1) : "";
    const withBasePath = (key: string): string =>
      path.join(normalizedBasePath, key);

    const copyIfExists = async (
      source: string,
      destination: string
    ): Promise<void> => {
      if (await fse.pathExists(source)) {
        await fse.copy(source, destination);
      }
    };

    // Copy BUILD_ID file
    const copyBuildId = copyIfExists(
      path.join(dotNextDirectory, "BUILD_ID"),
      path.join(assetOutputDirectory, withBasePath("BUILD_ID"))
    );

    const buildStaticFiles = await readDirectoryFiles(
      path.join(dotNextDirectory, "static")
    );

    const staticFileAssets = buildStaticFiles
      .filter(filterOutDirectories)
      .map(async (fileItem: Item) => {
        const source = fileItem.path;
        const destination = path.join(
          assetOutputDirectory,
          withBasePath(
            path
              .relative(path.resolve(nextConfigDir), source)
              .replace(/^.next/, "_next")
          )
        );

        return copyIfExists(source, destination);
      });

    const pagesManifest = await fse.readJSON(
      path.join(dotNextDirectory, "serverless/pages-manifest.json")
    );

    const htmlPageAssets = Object.values(pagesManifest)
      .filter((pageFile) => (pageFile as string).endsWith(".html"))
      .map((relativePageFilePath) => {
        const source = path.join(
          dotNextDirectory,
          `serverless/${relativePageFilePath}`
        );
        const destination = path.join(
          assetOutputDirectory,
          withBasePath(
            `static-pages/${buildId}/${(relativePageFilePath as string).replace(
              /^pages\//,
              ""
            )}`
          )
        );

        return copyIfExists(source, destination);
      });

    const prerenderManifest: PrerenderManifest = await fse.readJSON(
      path.join(dotNextDirectory, "prerender-manifest.json")
    );

    const prerenderManifestJSONPropFileAssets: Promise<void>[] = [];
    const prerenderManifestHTMLPageAssets: Promise<void>[] = [];
    const fallbackHTMLPageAssets: Promise<void>[] = [];

    // Copy locale-specific prerendered files if defined, otherwise use empty locale
    // which would copy to root only
    let locales;

    // @ts-ignore
    if (prerenderManifest.version > 2) {
      // In newer Next.js 10 versions with prerender manifest version 3, it has one entry for each locale: https://github.com/vercel/next.js/pull/21404
      // So we don't need to iterate through each locale and prefix manually
      locales = [""];
    } else {
      locales = routesManifest.i18n?.locales ?? [""];
    }

    for (const locale of locales) {
      prerenderManifestJSONPropFileAssets.concat(
        Object.keys(prerenderManifest.routes).map((key) => {
          const JSONFileName = key.endsWith("/")
            ? key + "index.json"
            : key + ".json";

          let localePrefixedJSONFileName;

          // If there are locales and index is SSG page
          // Filename is <locale>.json e.g en.json, not index.json or en/index.json
          if (locale && key === "/") {
            localePrefixedJSONFileName = `${locale}.json`;
          } else {
            localePrefixedJSONFileName = locale + JSONFileName;
          }

          const source = path.join(
            dotNextDirectory,
            `serverless/pages/${localePrefixedJSONFileName}`
          );
          const destination = path.join(
            assetOutputDirectory,
            withBasePath(`_next/data/${buildId}/${localePrefixedJSONFileName}`)
          );

          return copyIfExists(source, destination);
        })
      );

      prerenderManifestHTMLPageAssets.concat(
        Object.keys(prerenderManifest.routes).map((key) => {
          const pageFilePath = key.endsWith("/")
            ? path.join(key, "index.html")
            : key + ".html";

          // If there are locales and index is SSG page,
          // Filename is <locale>.html e.g en.html, not index.html or en/index.html
          let localePrefixedPageFilePath;
          if (locale && key === "/") {
            localePrefixedPageFilePath = `${locale}.html`;
          } else {
            localePrefixedPageFilePath = locale + pageFilePath;
          }

          const source = path.join(
            dotNextDirectory,
            `serverless/pages/${localePrefixedPageFilePath}`
          );
          const destination = path.join(
            assetOutputDirectory,
            withBasePath(
              path.join("static-pages", buildId, localePrefixedPageFilePath)
            )
          );

          return copyIfExists(source, destination);
        })
      );
    }

    // Dynamic routes are unlocalized even in version 3
    for (const locale of routesManifest.i18n?.locales ?? [""]) {
      fallbackHTMLPageAssets.concat(
        Object.values(prerenderManifest.dynamicRoutes ?? {})
          .filter(({ fallback }) => {
            return !!fallback;
          })
          .map((routeConfig) => {
            const fallback = routeConfig.fallback as string;
            const localePrefixedFallback = locale + fallback;

            const source = path.join(
              dotNextDirectory,
              `serverless/pages/${localePrefixedFallback}`
            );

            const destination = path.join(
              assetOutputDirectory,
              withBasePath(
                path.join("static-pages", buildId, localePrefixedFallback)
              )
            );

            return copyIfExists(source, destination);
          })
      );
    }

    // Check if public/static exists and fail build since this conflicts with static/* behavior.
    if (await fse.pathExists(path.join(nextStaticDir, "public", "static"))) {
      throw new Error(
        "You cannot have assets in the directory [public/static] as they conflict with the static/* CloudFront cache behavior. Please move these assets into another directory."
      );
    }

    const buildPublicOrStaticDirectory = async (
      directory: "public" | "static"
    ) => {
      const directoryPath = path.join(nextStaticDir, directory);
      if (!(await fse.pathExists(directoryPath))) {
        return Promise.resolve([]);
      }

      const files = await readDirectoryFiles(directoryPath);

      return files.filter(filterOutDirectories).map((fileItem: Item) => {
        const source = fileItem.path;
        const destination = path.join(
          assetOutputDirectory,
          withBasePath(
            path.relative(path.resolve(nextStaticDir), fileItem.path)
          )
        );

        return fse.copy(source, destination);
      });
    };

    const publicDirAssets = await buildPublicOrStaticDirectory("public");
    const staticDirAssets = await buildPublicOrStaticDirectory("static");

    return Promise.all([
      copyBuildId, // BUILD_ID
      ...staticFileAssets, // .next/static
      ...htmlPageAssets, // prerendered html pages
      ...prerenderManifestJSONPropFileAssets, // SSG json files
      ...prerenderManifestHTMLPageAssets, // SSG html files
      ...fallbackHTMLPageAssets, // fallback files
      ...publicDirAssets, // public dir
      ...staticDirAssets // static dir
    ]);
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

  async build(debugMode?: boolean): Promise<void> {
    const { cmd, args, cwd, env, useServerlessTraceTarget } = Object.assign(
      defaultBuildOptions,
      this.buildOptions
    );

    await this.cleanupDotNext();

    await fse.emptyDir(join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR));
    await fse.emptyDir(join(this.outputDir, API_LAMBDA_CODE_DIR));
    await fse.emptyDir(join(this.outputDir, IMAGE_LAMBDA_CODE_DIR));
    await fse.emptyDir(join(this.outputDir, REGENERATION_LAMBDA_CODE_DIR));
    await fse.emptyDir(join(this.outputDir, ASSETS_DIR));

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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const routesManifest = require(join(
      this.dotNextDir,
      "routes-manifest.json"
    ));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prerenderManifest = require(join(
      this.dotNextDir,
      "prerender-manifest.json"
    ));

    const options = {
      buildId: await fse.readFile(
        path.join(this.dotNextDir, "BUILD_ID"),
        "utf-8"
      ),
      ...this.buildOptions,
      domainRedirects: this.buildOptions.domainRedirects ?? {}
    };

    const { apiManifest, imageManifest, pageManifest } =
      await prepareBuildManifests(
        options,
        await this.readNextConfig(),
        routesManifest,
        await this.readPagesManifest(),
        prerenderManifest,
        await this.readPublicFiles()
      );

    const { enableHTTPCompression, logLambdaExecutionTimes } =
      this.buildOptions;

    const apiBuildManifest = {
      ...apiManifest,
      enableHTTPCompression
    };
    const defaultBuildManifest = {
      ...pageManifest,
      enableHTTPCompression,
      logLambdaExecutionTimes
    };
    const imageBuildManifest = {
      ...imageManifest,
      enableHTTPCompression
    };

    await this.buildDefaultLambda(defaultBuildManifest);
    await this.buildRegenerationHandler(defaultBuildManifest);

    const hasAPIPages =
      Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
      Object.keys(apiBuildManifest.apis.dynamic).length > 0;

    if (hasAPIPages) {
      await this.buildApiLambda(apiBuildManifest);
    }

    // If using Next.j 10, then images-manifest.json is present and image optimizer can be used
    const hasImagesManifest = fse.existsSync(
      join(this.dotNextDir, "images-manifest.json")
    );

    // However if using a non-default loader, the lambda is not needed
    const imagesManifest = hasImagesManifest
      ? await fse.readJSON(join(this.dotNextDir, "images-manifest.json"))
      : null;
    const imageLoader = imagesManifest?.images?.loader;
    const isDefaultLoader = !imageLoader || imageLoader === "default";
    const hasImageOptimizer = hasImagesManifest && isDefaultLoader;

    // ...nor if the image component is not used
    const exportMarker = fse.existsSync(
      join(this.dotNextDir, "export-marker.json")
    )
      ? await fse.readJSON(path.join(this.dotNextDir, "export-marker.json"))
      : {};
    const isNextImageImported = exportMarker.isNextImageImported !== false;

    if (hasImageOptimizer && isNextImageImported) {
      await this.buildImageLambda(imageBuildManifest);
    }

    // Copy static assets to .serverless_nextjs directory
    await this.buildStaticAssets(defaultBuildManifest, routesManifest);
  }
}

export default Builder;
