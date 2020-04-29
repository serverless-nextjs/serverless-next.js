import path from "path";
import fse from "fs-extra";
import mime from "mime-types";
import klaw, { Item } from "klaw";
import AWS from "aws-sdk";

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextAppDir: string;
};
const filePathToS3Key = (filePath: string): string => {
  const relevantFilePathPart = filePath.substring(
    filePath.indexOf(".next" + path.sep)
  );
  return relevantFilePathPart.replace(".next", "_next");
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
    .map(async fileItem => {
      const fileBody = await fse.readFile(fileItem.path);

      const s3Key = filePathToS3Key(fileItem.path);

      return s3
        .upload({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileBody,
          ContentType:
            mime.lookup(path.basename(fileItem.path)) ||
            "application/octet-stream",
          CacheControl: "public, max-age=31536000, immutable"
        })
        .promise();
    });

  await Promise.all(uploadTasks);
  // read public/ folder and upload files
  // read static/ folder and upload files
  // get HTML pages from pages manifest
  // get JSON data files from prerender manifest
};

export default uploadStaticAssets;
