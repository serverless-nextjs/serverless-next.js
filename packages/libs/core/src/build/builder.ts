import fse from "fs-extra";
import { join } from "path";
import path from "path";
import {
  CoreBuildOptions,
  Manifest,
  PageManifest,
  RoutesManifest
} from "types";
import { isTrailingSlashRedirect } from "./lib/redirector";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { NextConfig } from "./types";
import normalizePath from "normalize-path";
import createServerlessConfig from "./lib/createServerlessConfig";
import execa from "execa";
import { prepareBuildManifests } from "./";
import pathToPosix from "./lib/pathToPosix";

export const ASSETS_DIR = "assets";

const defaultBuildOptions = {
  nextConfigDir: "./",
  nextStaticDir: undefined,
  outputDir: ".serverless_nextjs",
  args: ["build"],
  cwd: process.cwd(),
  env: {},
  cmd: "./node_modules/.bin/next",
  domainRedirects: {},
  minifyHandlers: false,
  handler: undefined,
  authentication: undefined,
  baseDir: process.cwd(),
  cleanupDotNext: true,
  assetIgnorePatterns: []
};

/**
 * Core builder class that has common build functions for all platforms.
 */
export default abstract class CoreBuilder {
  protected nextConfigDir: string;
  protected nextStaticDir: string;
  protected dotNextDir: string;
  protected serverlessDir: string;
  protected outputDir: string;
  protected buildOptions = defaultBuildOptions;

  public constructor(buildOptions?: CoreBuildOptions) {
    if (buildOptions) {
      Object.assign(this.buildOptions, buildOptions);
    }

    this.nextConfigDir = path.resolve(this.buildOptions.nextConfigDir);
    this.nextStaticDir = path.resolve(
      this.buildOptions.nextStaticDir ?? this.buildOptions.nextConfigDir
    );
    this.dotNextDir = path.join(this.nextConfigDir, ".next");
    this.serverlessDir = path.join(this.dotNextDir, "serverless");
    this.outputDir = this.buildOptions.outputDir;
  }

  public async build(debugMode?: boolean): Promise<void> {
    await this.preBuild();
    const { imageManifest, pageManifest } = await this.buildCore(debugMode);
    await this.buildPlatform({ imageManifest, pageManifest }, debugMode);
  }

  /**
   * Run prebuild steps which include cleaning up .next and emptying output directories.
   */
  protected async preBuild(): Promise<void> {
    await Promise.all([
      this.cleanupDotNext(this.buildOptions.cleanupDotNext),
      fse.emptyDir(join(this.outputDir))
    ]);
  }

  /**
   * Platform-specific build steps which include the handlers that are to be deployed.
   * @param manifests
   * @param debugMode
   */
  protected abstract buildPlatform(
    manifests: {
      imageManifest: Manifest;
      pageManifest: Manifest;
    },
    debugMode?: boolean
  ): Promise<void>;

  /**
   * Core build steps. Currently this runs the .next build and packages the assets since they are the same for all platforms.
   * @param debugMode
   */
  public async buildCore(debugMode?: boolean): Promise<{
    imageManifest: Manifest;
    pageManifest: PageManifest;
  }> {
    const { cmd, args, cwd, env, assetIgnorePatterns } = Object.assign(
      defaultBuildOptions,
      this.buildOptions
    );

    const { restoreUserConfig } = await createServerlessConfig(
      cwd,
      path.join(this.nextConfigDir),
      false
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
      useV2Handler: true, // FIXME: temporary to combine API and regular pages until this is deprecated and removed
      ...this.buildOptions,
      domainRedirects: this.buildOptions.domainRedirects ?? {}
    };

    const { imageManifest, pageManifest } = await prepareBuildManifests(
      options,
      await this.readNextConfig(),
      routesManifest,
      await this.readPagesManifest(),
      prerenderManifest,
      await this.readPublicFiles(assetIgnorePatterns)
    );

    // Copy any static assets to .serverless_nextjs/assets directory
    // This step is common to all platforms so it's in the core build step.
    await this.buildStaticAssets(
      pageManifest,
      routesManifest,
      assetIgnorePatterns
    );

    return { imageManifest, pageManifest };
  }

  protected async readPublicFiles(
    assetIgnorePatterns: string[]
  ): Promise<string[]> {
    const dirExists = await fse.pathExists(join(this.nextConfigDir, "public"));
    if (dirExists) {
      const files = await readDirectoryFiles(
        join(this.nextConfigDir, "public"),
        assetIgnorePatterns
      );

      return files
        .map((e) => normalizePath(e.path)) // normalization to unix paths needed for AWS
        .map((path) => path.replace(normalizePath(this.nextConfigDir), ""))
        .map((path) => path.replace("/public/", ""));
    } else {
      return [];
    }
  }

  protected async readPagesManifest(): Promise<{ [key: string]: string }> {
    const path = join(this.serverlessDir, "pages-manifest.json");
    const hasServerlessPageManifest = await fse.pathExists(path);

    if (!hasServerlessPageManifest) {
      return Promise.reject(
        "pages-manifest not found. Check if `next.config.js` target is set to 'serverless'"
      );
    }

    return await fse.readJSON(path);
  }

  /**
   * Check whether this .next/serverless/pages file is a JS file used for runtime rendering.
   * @param pageManifest
   * @param relativePageFile
   */
  protected isSSRJSFile(
    pageManifest: PageManifest,
    relativePageFile: string
  ): boolean {
    if (path.extname(relativePageFile) === ".js") {
      const page = relativePageFile.startsWith("/")
        ? `pages${relativePageFile}`
        : `pages/${relativePageFile}`;
      if (
        page === "pages/_error.js" ||
        Object.values(pageManifest.pages.ssr.nonDynamic).includes(page) ||
        Object.values(pageManifest.pages.ssr.dynamic).includes(page)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process and copy RoutesManifest.
   * @param source
   * @param destination
   */
  protected async processAndCopyRoutesManifest(
    source: string,
    destination: string
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const routesManifest = require(source) as RoutesManifest;

    // Remove default trailing slash redirects as they are already handled without regex matching.
    routesManifest.redirects = routesManifest.redirects.filter((redirect) => {
      return !isTrailingSlashRedirect(redirect, routesManifest.basePath);
    });

    await fse.writeFile(destination, JSON.stringify(routesManifest));
  }

  /**
   * Get filter function for files to be included in the default handler.
   */
  protected getDefaultHandlerFileFilter(
    hasAPIRoutes: boolean,
    pageManifest: PageManifest
  ): (file: string) => boolean {
    return (file: string) => {
      const isNotPrerenderedHTMLPage = path.extname(file) !== ".html";
      const isNotStaticPropsJSONFile = path.extname(file) !== ".json";

      // If there are API routes, include all JS files.
      // If there are no API routes, include only JS files that used for SSR (including fallback).
      // We do this because if there are API routes, preview mode is possible which may use these JS files.
      // This is what Vercel does: https://github.com/vercel/next.js/discussions/15631#discussioncomment-44289
      // TODO: possibly optimize bundle further for those apps using API routes.
      const isNotExcludedJSFile =
        hasAPIRoutes ||
        path.extname(file) !== ".js" ||
        this.isSSRJSFile(
          pageManifest,
          pathToPosix(
            path.relative(path.join(this.serverlessDir, "pages"), file)
          ) // important: make sure to use posix path to generate forward-slash path across both posix/windows
        );

      return (
        isNotPrerenderedHTMLPage &&
        isNotStaticPropsJSONFile &&
        isNotExcludedJSFile
      );
    };
  }

  /**
   * Copy code chunks generated by Next.js.
   */
  protected async copyChunks(handlerDir: string): Promise<void> {
    return (await fse.pathExists(join(this.serverlessDir, "chunks")))
      ? fse.copy(
          join(this.serverlessDir, "chunks"),
          join(this.outputDir, handlerDir, "chunks")
        )
      : Promise.resolve();
  }

  /**
   * Copy additional JS files needed such as webpack-runtime.js (new in Next.js 12)
   */
  protected async copyJSFiles(handlerDir: string): Promise<void> {
    await Promise.all([
      (await fse.pathExists(join(this.serverlessDir, "webpack-api-runtime.js")))
        ? fse.copy(
            join(this.serverlessDir, "webpack-api-runtime.js"),
            join(this.outputDir, handlerDir, "webpack-api-runtime.js")
          )
        : Promise.resolve(),
      (await fse.pathExists(join(this.serverlessDir, "webpack-runtime.js")))
        ? fse.copy(
            join(this.serverlessDir, "webpack-runtime.js"),
            join(this.outputDir, handlerDir, "webpack-runtime.js")
          )
        : Promise.resolve()
    ]);
  }

  protected async readNextConfig(): Promise<NextConfig | undefined> {
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
  protected async buildStaticAssets(
    pageManifest: PageManifest,
    routesManifest: RoutesManifest,
    ignorePatterns: string[]
  ) {
    const buildId = pageManifest.buildId;
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
      path.join(dotNextDirectory, "static"),
      ignorePatterns
    );

    const staticFileAssets = buildStaticFiles
      .filter(filterOutDirectories)
      .map((fileItem: any) => {
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

    const htmlPaths = [
      ...Object.keys(pageManifest.pages.html.dynamic),
      ...Object.keys(pageManifest.pages.html.nonDynamic)
    ];

    const ssgPaths = Object.keys(pageManifest.pages.ssg.nonDynamic);

    const fallbackFiles = Object.values(pageManifest.pages.ssg.dynamic)
      .map(({ fallback }) => fallback)
      .filter((fallback) => fallback);

    const htmlFiles = [...htmlPaths, ...ssgPaths].map((path) => {
      return path.endsWith("/") ? `${path}index.html` : `${path}.html`;
    });

    const jsonFiles = ssgPaths.map((path) => {
      return path.endsWith("/") ? `${path}index.json` : `${path}.json`;
    });

    const htmlAssets = [...htmlFiles, ...fallbackFiles].map((file) => {
      const source = path.join(dotNextDirectory, `serverless/pages${file}`);
      const destination = path.join(
        assetOutputDirectory,
        withBasePath(`static-pages/${buildId}${file}`)
      );

      return copyIfExists(source, destination);
    });

    const jsonAssets = jsonFiles.map((file) => {
      const source = path.join(dotNextDirectory, `serverless/pages${file}`);
      const destination = path.join(
        assetOutputDirectory,
        withBasePath(`_next/data/${buildId}${file}`)
      );

      return copyIfExists(source, destination);
    });

    const buildPublicOrStaticDirectory = async (
      directory: "public" | "static"
    ) => {
      const directoryPath = path.join(nextStaticDir, directory);
      if (!(await fse.pathExists(directoryPath))) {
        return Promise.resolve([]);
      }

      const files = await readDirectoryFiles(directoryPath, ignorePatterns);

      return files.filter(filterOutDirectories).map((fileItem: any) => {
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

    const [publicDirAssets, staticDirAssets] = await Promise.all([
      buildPublicOrStaticDirectory("public"),
      buildPublicOrStaticDirectory("static")
    ]);

    return Promise.all([
      copyBuildId, // BUILD_ID
      ...staticFileAssets, // .next/static
      ...htmlAssets, // prerendered html pages
      ...jsonAssets, // SSG json files
      ...publicDirAssets, // public dir
      ...staticDirAssets // static dir
    ]);
  }

  protected async cleanupDotNext(shouldClean: boolean): Promise<void> {
    if (!shouldClean) {
      return;
    }

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
}
