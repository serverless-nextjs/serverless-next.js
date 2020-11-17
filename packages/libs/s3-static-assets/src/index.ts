import AWS from "aws-sdk";
import path, { join } from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import {
  IMMUTABLE_CACHE_CONTROL_HEADER,
  SERVER_NO_CACHE_CACHE_CONTROL_HEADER,
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

  // Upload BUILD_ID file to represent the current build ID to be uploaded. This is for metadata and also used for deleting old versioned files.
  const buildIdPath = path.join(
    assetsOutputDirectory,
    normalizedBasePath,
    "BUILD_ID"
  );
  const buildIdUpload = s3.uploadFile({
    s3Key: pathToPosix(path.join(normalizedBasePath, "BUILD_ID")),
    filePath: buildIdPath
  });

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

      // Dynamic fallback HTML pages should never be cached as it will override actual pages once generated and stored in S3.
      const isDynamicFallback = /\[.*]/.test(s3Key);
      if (isDynamicFallback) {
        return s3.uploadFile({
          s3Key,
          filePath: fileItem.path,
          cacheControl: SERVER_NO_CACHE_CACHE_CONTROL_HEADER
        });
      } else {
        return s3.uploadFile({
          s3Key,
          filePath: fileItem.path,
          cacheControl: SERVER_CACHE_CONTROL_HEADER
        });
      }
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
    ...publicAndStaticUploads,
    buildIdUpload
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

type DeleteOldStaticAssetsOptions = {
  bucketName: string;
  basePath: string;
  credentials: Credentials;
};

/**
 * Remove old static assets from S3 bucket. This reads the existing BUILD_ID file from S3.
 * If it exists, it removes all versioned assets except that BUILD_ID, in order to save S3 storage costs.
 * @param options
 */
const deleteOldStaticAssets = async (
  options: DeleteOldStaticAssetsOptions
): Promise<void> => {
  const { bucketName, basePath } = options;

  const normalizedBasePathPrefix = basePath ? basePath.slice(1) + "/" : "";

  const s3 = await S3ClientFactory({
    bucketName,
    credentials: options.credentials
  });

  // Get BUILD_ID file from S3 if it exists
  let buildId = await s3.getFile({
    key: normalizedBasePathPrefix + "BUILD_ID"
  });

  // If above exists, remove all versioned assets that are not BUILD_ID file (we don't remove unversioned pages static-pages as those are the previous way)
  if (buildId) {
    // Delete old _next/data versions except for buildId
    const deleteNextDataFiles = s3.deleteFilesByPattern({
      prefix: `${normalizedBasePathPrefix}_next/data`,
      pattern: new RegExp(`${normalizedBasePathPrefix}_next/data/.+/`), // Ensure to only delete versioned directories
      excludePattern: new RegExp(
        `${normalizedBasePathPrefix}_next/data/${buildId}/`
      ) // Don't delete given build ID
    });

    // Delete old static-pages versions except for buildId
    const deleteStaticPageFiles = s3.deleteFilesByPattern({
      prefix: `${normalizedBasePathPrefix}static-pages`,
      pattern: new RegExp(`${normalizedBasePathPrefix}static-pages/.+/`), // Ensure to only delete versioned directories
      excludePattern: new RegExp(
        `${normalizedBasePathPrefix}static-pages/${buildId}/`
      ) // Don't delete given build ID
    });

    // Run deletion tasks in parallel (safe since they have different prefixes)
    await Promise.all([deleteNextDataFiles, deleteStaticPageFiles]);
  }
};

export {
  deleteOldStaticAssets,
  uploadStaticAssetsFromBuild,
  uploadStaticAssets
};
