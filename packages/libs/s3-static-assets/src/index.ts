import AWS from "aws-sdk";
import path, { join } from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import {
  IMMUTABLE_CACHE_CONTROL_HEADER,
  SERVER_CACHE_CONTROL_HEADER
} from "./lib/constants";
import S3ClientFactory, { Credentials } from "./lib/s3";
import pathToPosix from "./lib/pathToPosix";
import { PrerenderManifest } from "next/dist/build/index";
import getPublicAssetCacheControl, {
  PublicDirectoryCache
} from "./lib/getPublicAssetCacheControl";

type UploadStaticAssetsOptions = {
  bucketName: string;
  basePath: string;
  nextConfigDir: string;
  nextStaticDir?: string;
  credentials: Credentials;
  publicDirectoryCache?: PublicDirectoryCache;
};

/**
 * Uploads from built assets folder in .serverless_nextjs/assets to S3.
 * This is used to decouple a build from deployment.
 * Currently this works for Lambda@Edge deployment.
 */
const uploadStaticAssetsFromBuild = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  const {
    bucketName,
    credentials,
    basePath,
    publicDirectoryCache,
    nextConfigDir
  } = options;
  const s3 = await S3ClientFactory({
    bucketName,
    credentials: credentials
  });

  const normalizedBasePath = basePath ? basePath.slice(1) : "";

  const assetsOutputDirectory = path.join(
    nextConfigDir,
    ".serverless_nextjs",
    "assets"
  );

  // Upload Next.js static files

  const nextStaticFiles = await readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "_next", "static")
  );

  const nextStaticFilesUploads = nextStaticFiles
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        path.relative(assetsOutputDirectory, fileItem.path)
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });
    });

  // Upload Next.js data files

  const nextDataFiles = await readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "_next", "data")
  );

  const nextDataFilesUploads = nextDataFiles
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        path.relative(assetsOutputDirectory, fileItem.path)
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: SERVER_CACHE_CONTROL_HEADER
      });
    });

  // Upload Next.js HTML pages

  const htmlPages = await readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "static-pages")
  );

  const htmlPagesUploads = htmlPages
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        path.relative(assetsOutputDirectory, fileItem.path)
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: SERVER_CACHE_CONTROL_HEADER
      });
    });

  // Upload user static and public files

  const publicFiles = await readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "public")
  );

  const staticFiles = await readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "static")
  );

  const publicAndStaticUploads = [...publicFiles, ...staticFiles]
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        path.relative(assetsOutputDirectory, fileItem.path)
      );

      return s3.uploadFile({
        filePath: fileItem.path,
        s3Key: s3Key,
        cacheControl: getPublicAssetCacheControl(
          fileItem.path,
          publicDirectoryCache
        )
      });
    });

  return Promise.all([
    ...nextStaticFilesUploads,
    ...nextDataFilesUploads,
    ...htmlPagesUploads,
    ...publicAndStaticUploads
  ]);
};

/**
 * @deprecated This uploads directly from .next build directory. Deprecated since
 * it couples the build and deploy steps for S3 into one. The new method is to use
 * uploadStaticAssetsFromBuild() instead.
 * @param options
 */
const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  const {
    bucketName,
    basePath,
    nextConfigDir,
    nextStaticDir = nextConfigDir
  } = options;
  const s3 = await S3ClientFactory({
    bucketName,
    credentials: options.credentials
  });

  const dotNextDirectory = path.join(nextConfigDir, ".next");

  const s3BasePath = basePath ? basePath.slice(1) : "";

  const buildStaticFiles = await readDirectoryFiles(
    path.join(dotNextDirectory, "static")
  );

  const withBasePath = (key: string): string => path.join(s3BasePath, key);

  const buildStaticFileUploads = buildStaticFiles
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        withBasePath(
          path
            .relative(path.resolve(nextConfigDir), fileItem.path)
            .replace(/^.next/, "_next")
        )
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });
    });

  const pagesManifest = await fse.readJSON(
    path.join(dotNextDirectory, "serverless/pages-manifest.json")
  );

  const htmlPageUploads = Object.values(pagesManifest)
    .filter((pageFile) => (pageFile as string).endsWith(".html"))
    .map((relativePageFilePath) => {
      const pageFilePath = path.join(
        dotNextDirectory,
        `serverless/${relativePageFilePath}`
      );

      return s3.uploadFile({
        s3Key: pathToPosix(
          withBasePath(
            `static-pages/${(relativePageFilePath as string).replace(
              /^pages\//,
              ""
            )}`
          )
        ),
        filePath: pageFilePath,
        cacheControl: SERVER_CACHE_CONTROL_HEADER
      });
    });

  const prerenderManifest: PrerenderManifest = await fse.readJSON(
    path.join(dotNextDirectory, "prerender-manifest.json")
  );

  const prerenderManifestJSONPropFileUploads = Object.keys(
    prerenderManifest.routes
  ).map((key) => {
    const pageFilePath = pathToPosix(
      path.join(
        dotNextDirectory,
        `serverless/pages/${
          key.endsWith("/") ? key + "index.json" : key + ".json"
        }`
      )
    );

    return s3.uploadFile({
      s3Key: pathToPosix(
        withBasePath(prerenderManifest.routes[key].dataRoute.slice(1))
      ),
      filePath: pageFilePath,
      cacheControl: SERVER_CACHE_CONTROL_HEADER
    });
  });

  const prerenderManifestHTMLPageUploads = Object.keys(
    prerenderManifest.routes
  ).map((key) => {
    const relativePageFilePath = key.endsWith("/")
      ? path.posix.join(key, "index.html")
      : key + ".html";

    const pageFilePath = pathToPosix(
      path.join(dotNextDirectory, `serverless/pages/${relativePageFilePath}`)
    );

    return s3.uploadFile({
      s3Key: pathToPosix(
        withBasePath(path.posix.join("static-pages", relativePageFilePath))
      ),
      filePath: pageFilePath,
      cacheControl: SERVER_CACHE_CONTROL_HEADER
    });
  });

  const fallbackHTMLPageUploads = Object.values(
    prerenderManifest.dynamicRoutes || {}
  )
    .filter(({ fallback }) => {
      return !!fallback;
    })
    .map((routeConfig) => {
      const fallback = routeConfig.fallback as string;
      const pageFilePath = pathToPosix(
        path.join(dotNextDirectory, `serverless/pages/${fallback}`)
      );
      return s3.uploadFile({
        s3Key: pathToPosix(
          withBasePath(path.posix.join("static-pages", fallback))
        ),
        filePath: pageFilePath,
        cacheControl: SERVER_CACHE_CONTROL_HEADER
      });
    });

  const uploadPublicOrStaticDirectory = async (
    directory: "public" | "static",
    publicDirectoryCache?: PublicDirectoryCache
  ): Promise<Promise<AWS.S3.ManagedUpload.SendData>[]> => {
    const directoryPath = path.join(nextStaticDir, directory);
    if (!(await fse.pathExists(directoryPath))) {
      return Promise.resolve([]);
    }

    const files = await readDirectoryFiles(directoryPath);

    return files.filter(filterOutDirectories).map((fileItem) =>
      s3.uploadFile({
        filePath: fileItem.path,
        s3Key: pathToPosix(
          withBasePath(
            path.relative(path.resolve(nextStaticDir), fileItem.path)
          )
        ),
        cacheControl: getPublicAssetCacheControl(
          fileItem.path,
          publicDirectoryCache
        )
      })
    );
  };

  const publicDirUploads = await uploadPublicOrStaticDirectory(
    "public",
    options.publicDirectoryCache
  );
  const staticDirUploads = await uploadPublicOrStaticDirectory(
    "static",
    options.publicDirectoryCache
  );

  const allUploads = [
    ...buildStaticFileUploads, // .next/static
    ...htmlPageUploads, // prerendered html pages
    ...prerenderManifestJSONPropFileUploads, // SSG json files
    ...prerenderManifestHTMLPageUploads, // SSG html files
    ...fallbackHTMLPageUploads, // fallback files
    ...publicDirUploads, // public dir
    ...staticDirUploads // static dir
  ];

  return Promise.all(allUploads);
};

export { uploadStaticAssetsFromBuild, uploadStaticAssets };
