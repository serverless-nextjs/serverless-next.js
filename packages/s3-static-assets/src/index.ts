import AWS from "aws-sdk";
import path from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "./lib/constants";
import S3ClientFactory, { Credentials } from "./lib/s3";
import pathToPosix from "./lib/pathToPosix";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextConfigDir: string;
  credentials: Credentials;
};

type NextBuildManifest = {
  pages: {
    [pageRoute: string]: string[];
  };
};

const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  const { bucketName, nextConfigDir } = options;

  const s3 = await S3ClientFactory({
    bucketName,
    credentials: options.credentials
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
      const s3Key = pathToPosix(
        path
          .relative(path.resolve(nextConfigDir), fileItem.path)
          .replace(/^.next/, "_next")
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });
    });

  const buildManifest: NextBuildManifest = await fse.readJson(
    path.join(dotNextDirectory, "build-manifest.json")
  );

  const buildManifestFileUploads = Object.values(buildManifest.pages)
    .reduce((acc, pageBuildFiles) => {
      return acc.concat(pageBuildFiles);
    }, [])
    .map(relativeFilePath => {
      return s3.uploadFile({
        s3Key: `_next/${relativeFilePath}`,
        filePath: path.join(dotNextDirectory, relativeFilePath),
        cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
      });
    });

  const pagesManifest = await fse.readJSON(
    path.join(dotNextDirectory, "serverless/pages-manifest.json")
  );

  const htmlPageUploads = Object.values(pagesManifest)
    .filter(pageFile => (pageFile as string).endsWith(".html"))
    .map(relativePageFilePath => {
      const pageFilePath = pathToPosix(
        path.join(dotNextDirectory, `serverless/${relativePageFilePath}`)
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
    const directoryPath = path.join(nextConfigDir, directory);

    if (!(await fse.pathExists(directoryPath))) {
      return Promise.resolve([]);
    }

    const files = await readDirectoryFiles(directoryPath);

    return files.filter(filterOutDirectories).map(fileItem =>
      s3.uploadFile({
        filePath: fileItem.path,
        s3Key: pathToPosix(
          path.relative(path.resolve(nextConfigDir), fileItem.path)
        )
      })
    );
  };

  const publicDirUploads = await uploadPublicOrStaticDirectory("public");
  const staticDirUploads = await uploadPublicOrStaticDirectory("static");

  const allUploads = [
    ...nextBuildFileUploads, // .next/static/BUILD_ID/*
    ...buildManifestFileUploads, // .next/static/runtime/x.js, //.next/static/chunks/y.js ... as specified in build-manifest.json
    ...htmlPageUploads, // prerendered HTML pages
    ...publicDirUploads, // app public dir
    ...staticDirUploads // app static dir
  ];

  return Promise.all(allUploads);
};

export default uploadStaticAssets;
