import path from "path";
import fse from "fs-extra";
import mime from "mime-types";
import klaw, { Item } from "klaw";
import AWS from "aws-sdk";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextAppDir: string;
};

const readDirectoryFiles = (directory: string): Promise<Array<Item>> => {
  const items: Item[] = [];
  return new Promise((resolve, reject) => {
    klaw(directory.trim())
      .on("data", item => items.push(item))
      .on("end", () => {
        resolve(items);
      })
      .on("error", reject);
  });
};

const uploadStaticAssets = async (
  options: UploadStaticAssetsOptions
): Promise<void> => {
  const { bucketName, nextAppDir } = options;

  const s3 = new AWS.S3();

  const dotNextDirectory = path.join(nextAppDir, ".next");

  const BUILD_ID = fse
    .readFileSync(path.join(dotNextDirectory, "BUILD_ID"))
    .toString("utf8");

  const buildStaticFiles = await readDirectoryFiles(
    path.join(dotNextDirectory, "static", BUILD_ID)
  );

  const uploadTasks = buildStaticFiles
    .filter(item => !item.stats.isDirectory())
    .map(fileItem => {
      return fse.readFile(fileItem.path).then(fileBodyStream =>
        s3
          .upload({
            Bucket: bucketName,
            Key: fileItem.path,
            Body: fileBodyStream,
            ContentType:
              mime.lookup(path.basename(fileItem.path)) ||
              "application/octet-stream",
            CacheControl: "public, max-age=31536000, immutable"
          })
          .promise()
      );
    });

  await Promise.all(uploadTasks);
  // read public/ folder and upload files
  // read static/ folder and upload files
  // get HTML pages from pages manifest
  // get JSON data files from prerender manifest
};

export default uploadStaticAssets;
