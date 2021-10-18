import execa from "execa";
import fse from "fs-extra";
import { join } from "path";
import path from "path";
import { ImageBuildManifest, PageManifest, RoutesManifest } from "types";
import pathToPosix from "./lib/pathToPosix";
import createServerlessConfig from "./lib/createServerlessConfig";
import { isTrailingSlashRedirect } from "./lib/redirector";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { Job } from "@vercel/nft/out/node-file-trace";
import { prepareBuildManifests } from "./index";
import { NextConfig } from "./types";
import { NextI18nextIntegration } from "build/third-party/next-i18next";
import normalizePath from "normalize-path";

export const DEFAULT_LAMBDA_CODE_DIR = "default-lambda";
export const IMAGE_LAMBDA_CODE_DIR = "image-lambda";
export const ASSETS_DIR = "assets";

type BuildOptions = {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cmd?: string;
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
  ) => Promise<string | string[]>;
  baseDir?: string;
  cleanupDotNext?: boolean;
  assetIgnorePatterns?: string[];
  regenerationQueueName?: string;
};

const defaultBuildOptions = {
  args: [],
  cwd: process.cwd(),
  env: {},
  cmd: "./node_modules/.bin/next",
  logLambdaExecutionTimes: false,
  domainRedirects: {},
  minifyHandlers: false,
  enableHTTPCompression: true,
  authentication: undefined,
  resolve: undefined,
  baseDir: process.cwd(),
  cleanupDotNext: true,
  assetIgnorePatterns: [],
  regenerationQueueName: undefined
};

class CoreBuilder {
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

  async readPublicFiles(assetIgnorePatterns: string[]): Promise<string[]> {
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

  /**
   * Check whether this .next/serverless/pages file is a JS file used for runtime rendering.
   * @param pageManifest
   * @param relativePageFile
   */
  isSSRJSFile(pageManifest: PageManifest, relativePageFile: string): boolean {
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
  async processAndCopyRoutesManifest(
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
   * Process and copy handler code. This allows minifying it before copying to Lambda package.
   * @param handlerType
   * @param destination
   * @param shouldMinify
   */
  async processAndCopyHandler(
    handlerType: "default-handler" | "image-handler",
    destination: string,
    shouldMinify: boolean
  ): Promise<void> {
    const source = path.dirname(
      require.resolve(
        `@sls-next/lambda/dist/${handlerType}/${
          shouldMinify ? "minified" : "standard"
        }`
      )
    );

    await fse.copy(source, destination);
  }

  async buildDefaultLambda(pageManifest: PageManifest): Promise<void[]> {
    const hasAPIRoutes = await fse.pathExists(
      join(this.serverlessDir, "pages/api")
    );

    return Promise.all([
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
        pageManifest
      ),
      fse.copy(
        join(this.serverlessDir, "pages"),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, "pages"),
        {
          filter: (file: string) => {
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

  /**
   * copy chunks if present and not using serverless trace
   */
  copyChunks(buildDir: string): Promise<void> {
    return fse.existsSync(join(this.serverlessDir, "chunks"))
      ? fse.copy(
          join(this.serverlessDir, "chunks"),
          join(this.outputDir, buildDir, "chunks")
        )
      : Promise.resolve();
  }

  /**
   * Build image optimization lambda (supported by Next.js 10)
   * @param imageBuildManifest
   */
  async buildImageLambda(
    imageBuildManifest: ImageBuildManifest
  ): Promise<void> {
    await Promise.all([
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
        imageBuildManifest
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

  async cleanupDotNext(shouldClean: boolean): Promise<void> {
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

  async build(debugMode?: boolean): Promise<void> {
    const { cmd, args, cwd, env, cleanupDotNext, assetIgnorePatterns } =
      Object.assign(defaultBuildOptions, this.buildOptions);

    await Promise.all([
      this.cleanupDotNext(cleanupDotNext),
      fse.emptyDir(join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR)),
      fse.emptyDir(join(this.outputDir, IMAGE_LAMBDA_CODE_DIR)),
      fse.emptyDir(join(this.outputDir, ASSETS_DIR))
    ]);

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
        await this.readPublicFiles(assetIgnorePatterns)
      );

    const {
      enableHTTPCompression,
      logLambdaExecutionTimes,
      regenerationQueueName
    } = this.buildOptions;

    const defaultBuildManifest = {
      ...apiManifest,
      ...pageManifest,
      enableHTTPCompression,
      logLambdaExecutionTimes,
      regenerationQueueName
    };
    const imageBuildManifest = {
      ...imageManifest,
      enableHTTPCompression
    };

    await this.buildDefaultLambda(defaultBuildManifest);
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
    await this.buildStaticAssets(
      defaultBuildManifest,
      routesManifest,
      assetIgnorePatterns
    );
  }

  /**
   * Run additional integrations for third-party libraries such as next-i18next.
   * These are usually needed to add additional files into the lambda, etc.
   * @param defaultLambdaDir
   * @param regenerationLambdaDir
   */
  async runThirdPartyIntegrations(
    defaultLambdaDir: string,
    regenerationLambdaDir: string
  ): Promise<void> {
    await Promise.all([
      new NextI18nextIntegration(
        this.nextConfigDir,
        defaultLambdaDir
      ).execute(),
      new NextI18nextIntegration(
        this.nextConfigDir,
        regenerationLambdaDir
      ).execute()
    ]);
  }
}

export default CoreBuilder;
