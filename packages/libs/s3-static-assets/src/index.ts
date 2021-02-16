import AWS from "aws-sdk";
import path from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
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

type AssetDirectoryFileCachePoliciesOptions = {
  basePath: string;
  // The directory containing the build output.
  // .i.e. by default .serverless_nextjs
  serverlessBuildOutDir: string;
  nextStaticDir?: string;
  publicDirectoryCache?: PublicDirectoryCache;
};

/**
 * Returns an array of files with with their relevant cache policies.
 */
const getAssetDirectoryFileCachePolicies = (
  options: AssetDirectoryFileCachePoliciesOptions
): Array<{
  cacheControl: string | undefined;
  path: {
    relative: string;
    absolute: string;
  };
}> => {
  const { basePath, publicDirectoryCache, serverlessBuildOutDir } = options;

  const normalizedBasePath = basePath ? basePath.slice(1) : "";

  const assetsOutputDirectory = path.join(serverlessBuildOutDir, "assets");

  // Upload BUILD_ID file to represent the current build ID to be uploaded. This is for metadata and also used for deleting old versioned files.
  const buildIdPath = path.join(
    assetsOutputDirectory,
    normalizedBasePath,
    "BUILD_ID"
  );

  const buildIdUpload = {
    path: buildIdPath,
    cacheControl: undefined
  };

  // Upload Next.js static files

  const nextStaticFiles = readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "_next", "static")
  );

  const nextStaticFilesUploads = nextStaticFiles.map((fileItem) => ({
    path: fileItem.path,
    cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
  }));

  // Upload Next.js data files

  const nextDataFiles = readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "_next", "data")
  );

  const nextDataFilesUploads = nextDataFiles.map((fileItem) => ({
    path: fileItem.path,
    cacheControl: SERVER_CACHE_CONTROL_HEADER
  }));

  // Upload Next.js HTML pages

  const htmlPages = readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "static-pages")
  );

  const htmlPagesUploads = htmlPages.map((fileItem) => {
    // Dynamic fallback HTML pages should never be cached as it will override actual pages once generated and stored in S3.
    const isDynamicFallback = /\[.*]/.test(fileItem.path);
    if (isDynamicFallback) {
      return {
        path: fileItem.path,
        cacheControl: SERVER_NO_CACHE_CACHE_CONTROL_HEADER
      };
    } else {
      return {
        path: fileItem.path,
        cacheControl: SERVER_CACHE_CONTROL_HEADER
      };
    }
  });

  // Upload user static and public files

  const publicFiles = readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "public")
  );

  const staticFiles = readDirectoryFiles(
    path.join(assetsOutputDirectory, normalizedBasePath, "static")
  );

  const publicAndStaticUploads = [...publicFiles, ...staticFiles].map(
    (fileItem) => ({
      path: fileItem.path,
      cacheControl: getPublicAssetCacheControl(
        fileItem.path,
        publicDirectoryCache
      )
    })
  );

  return [
    ...nextStaticFilesUploads,
    ...nextDataFilesUploads,
    ...htmlPagesUploads,
    ...publicAndStaticUploads,
    buildIdUpload
  ].map(({ cacheControl, path: absolutePath }) => ({
    cacheControl,
    path: {
      // Path relative to the assets folder, used for the S3 upload key
      relative: path.relative(assetsOutputDirectory, absolutePath),
      // Absolute path of local asset
      absolute: absolutePath
    }
  }));
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
  const files = getAssetDirectoryFileCachePolicies({
    basePath,
    publicDirectoryCache,
    serverlessBuildOutDir: path.join(nextConfigDir, ".serverless_nextjs")
  });
  const s3 = await S3ClientFactory({
    bucketName,
    credentials: credentials
  });

  return Promise.all(
    files.map((file) =>
      s3.uploadFile({
        s3Key: pathToPosix(file.path.relative),
        filePath: file.path.absolute,
        cacheControl: file.cacheControl
      })
    )
  );
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

  const buildStaticFiles = readDirectoryFiles(
    path.join(dotNextDirectory, "static")
  );

  const withBasePath = (key: string): string => path.join(s3BasePath, key);

  const buildStaticFileUploads = buildStaticFiles.map(async (fileItem) => {
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

    const files = readDirectoryFiles(directoryPath);

    return files.map((fileItem) =>
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
  const buildId = await s3.getFile({
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
  getAssetDirectoryFileCachePolicies,
  deleteOldStaticAssets,
  uploadStaticAssetsFromBuild,
  uploadStaticAssets
};
