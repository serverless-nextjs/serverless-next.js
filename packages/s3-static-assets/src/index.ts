import AWS from "aws-sdk";
import path from "path";
import fse from "fs-extra";
import readDirectoryFiles from "./lib/readDirectoryFiles";
import filterOutDirectories from "./lib/filterOutDirectories";
import { IMMUTABLE_CACHE_CONTROL_HEADER } from "./lib/constants";
import S3ClientFactory, { Credentials } from "./lib/s3";
import pathToPosix from "./lib/pathToPosix";
import { PrerenderManifest } from "next/dist/build/index";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextConfigDir: string;
  nextStaticDir?: string;
  credentials: Credentials;
};

const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<AWS.S3.ManagedUpload.SendData[]> => {
  const { bucketName, nextConfigDir, nextStaticDir = nextConfigDir } = options;
  const s3 = await S3ClientFactory({
    bucketName,
    credentials: options.credentials
  });

  const dotNextDirectory = path.join(nextConfigDir, ".next");

  const buildStaticFiles = await readDirectoryFiles(
    path.join(dotNextDirectory, "static")
  );

  const buildStaticFileUploads = buildStaticFiles
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

  const prerenderManifest: PrerenderManifest = await fse.readJSON(
    path.join(dotNextDirectory, "prerender-manifest.json")
  );

  const prerenderManifestJSONPropFileUploads = Object.keys(
    prerenderManifest.routes
  ).map(key => {
    const pageFilePath = pathToPosix(
      path.join(
        dotNextDirectory,
        `serverless/pages/${
          key.endsWith("/") ? key + "index.json" : key + ".json"
        }`
      )
    );

    return s3.uploadFile({
      s3Key: prerenderManifest.routes[key].dataRoute.slice(1),
      filePath: pageFilePath
    });
  });

  const prerenderManifestHTMLPageUploads = Object.keys(
    prerenderManifest.routes
  ).map(key => {
    const relativePageFilePath = key.endsWith("/")
      ? path.posix.join(key, "index.html")
      : key + ".html";

    const pageFilePath = pathToPosix(
      path.join(dotNextDirectory, `serverless/pages/${relativePageFilePath}`)
    );

    return s3.uploadFile({
      s3Key: path.posix.join("static-pages", relativePageFilePath),
      filePath: pageFilePath
    });
  });

  const uploadPublicOrStaticDirectory = async (
    directory: "public" | "static"
  ): Promise<Promise<AWS.S3.ManagedUpload.SendData>[]> => {
    const directoryPath = path.join(nextStaticDir, directory);
    if (!(await fse.pathExists(directoryPath))) {
      return Promise.resolve([]);
    }

    const files = await readDirectoryFiles(directoryPath);

    return files.filter(filterOutDirectories).map(fileItem =>
      s3.uploadFile({
        filePath: fileItem.path,
        s3Key: pathToPosix(
          path.relative(path.resolve(nextStaticDir), fileItem.path)
        )
      })
    );
  };

  const publicDirUploads = await uploadPublicOrStaticDirectory("public");
  const staticDirUploads = await uploadPublicOrStaticDirectory("static");

  const allUploads = [
    ...buildStaticFileUploads, // .next/static
    ...htmlPageUploads, // prerendered HTML pages
    ...prerenderManifestJSONPropFileUploads, // SSG JSON files
    ...prerenderManifestHTMLPageUploads, // SSG HTML files
    ...publicDirUploads, // app public dir
    ...staticDirUploads // app static dir
  ];

  return Promise.all(allUploads);
};

export default uploadStaticAssets;
