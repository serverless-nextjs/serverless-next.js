import AWS from "aws-sdk";
import path from "path";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import {
  IMMUTABLE_CACHE_CONTROL_HEADER,
  SERVER_NO_CACHE_CACHE_CONTROL_HEADER,
  SERVER_CACHE_CONTROL_HEADER
} from "./lib/constants";
import S3ClientFactory, { Credentials } from "./lib/s3";
import pathToPosix from "./lib/pathToPosix";
import getPublicAssetCacheControl, {
  PublicDirectoryCache
} from "./lib/getPublicAssetCacheControl";

type UploadStaticAssetsOptions = {
  bucketName: string;
  bucketRegion: string;
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
    bucketRegion,
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
    bucketRegion,
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

type DeleteOldStaticAssetsOptions = {
  bucketName: string;
  bucketRegion: string;
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
  const { bucketName, bucketRegion, basePath } = options;

  const normalizedBasePathPrefix = basePath ? basePath.slice(1) + "/" : "";

  const s3 = await S3ClientFactory({
    bucketName,
    bucketRegion,
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
  uploadStaticAssetsFromBuild
};
