import AWS from "aws-sdk";
import path from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "./lib/constants";
import S3ClientFactory, { S3Client } from "./lib/s3";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextConfigDir: string;
};

const uploadPublicOrStaticDirectory = async (
  s3: S3Client,
  directory: "public" | "static",
  nextConfigDir: string
): Promise<Promise<AWS.S3.ManagedUpload.SendData>[]> => {
  const files = await readDirectoryFiles(path.join(nextConfigDir, directory));

  return files.filter(filterOutDirectories).map(fileItem =>
    s3.uploadFile({
      filePath: fileItem.path,
      s3Key: path.posix.relative(path.resolve(nextConfigDir), fileItem.path)
    })
  );
};

const filePathToS3Key = (filePath: string): string => {
  const relevantFilePathPart = filePath.substring(
    filePath.indexOf(".next" + path.sep)
  );
  return relevantFilePathPart.replace(".next", "_next");
};

const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData> => {
  const { bucketName, nextConfigDir } = options;

  const s3 = S3ClientFactory({
    bucketName
  });

  const dotNextDirectory = path.join(nextConfigDir, ".next");

  const BUILD_ID = fse
    .readFileSync(path.join(dotNextDirectory, "BUILD_ID"))
    .toString("utf8");

  const buildStaticFiles = await readDirectoryFiles(
    path.join(dotNextDirectory, "static", BUILD_ID)
  );

  const nextBuildFileUploads = buildStaticFiles
    .filter(filterOutDirectories)
    .map(async fileItem => {
      const s3Key = filePathToS3Key(fileItem.path);

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
    .filter(pageFile => (pageFile as string).endsWith(".html"))
    .map(relativePageFilePath => {
      const pageFilePath = path.join(
        dotNextDirectory,
        `serverless/${relativePageFilePath}`
      );

      return s3.uploadFile({
        s3Key: `static-pages/${relativePageFilePath.replace(/^pages\//, "")}`,
        filePath: pageFilePath
      });
    });

  const publicDirUploads = await uploadPublicOrStaticDirectory(
    s3,
    "public",
    nextConfigDir
  );

  const staticDirUploads = await uploadPublicOrStaticDirectory(
    s3,
    "static",
    nextConfigDir
  );

  const allUploads = [
    ...nextBuildFileUploads,
    ...htmlPageUploads,
    ...publicDirUploads,
    ...staticDirUploads
  ];

  return Promise.all(allUploads);
};

export default uploadStaticAssets;
