import AWS from "aws-sdk";
import path from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "./lib/constants";
import S3ClientFactory from "./lib/s3";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextConfigDir: string;
};

const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
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
      const s3Key = path
        .relative(path.resolve(nextConfigDir), fileItem.path)
        .replace(/^.next/, "_next");

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
        s3Key: `static-pages/${(relativePageFilePath as string).replace(
          /^pages\//,
          ""
        )}`,
        filePath: pageFilePath
      });
    });

  const uploadPublicOrStaticDirectory = async (
    directory: "public" | "static"
  ): Promise<Promise<AWS.S3.ManagedUpload.SendData>[]> => {
    const files = await readDirectoryFiles(path.join(nextConfigDir, directory));

    return files.filter(filterOutDirectories).map(fileItem =>
      s3.uploadFile({
        filePath: fileItem.path,
        s3Key: path.posix.relative(path.resolve(nextConfigDir), fileItem.path)
      })
    );
  };

  const publicDirUploads = await uploadPublicOrStaticDirectory("public");
  const staticDirUploads = await uploadPublicOrStaticDirectory("static");

  const allUploads = [
    ...nextBuildFileUploads,
    ...htmlPageUploads,
    ...publicDirUploads,
    ...staticDirUploads
  ];

  return Promise.all(allUploads);
};

export default uploadStaticAssets;
