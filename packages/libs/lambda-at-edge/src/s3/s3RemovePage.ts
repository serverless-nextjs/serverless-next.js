import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getPageKeys } from "./util";

interface S3RemovePageOptions {
  basePath: string | undefined;
  uri: string;
  bucketName: string | undefined;
  buildId: string;
  region: string | undefined;
}

/**
 * Remove a Page from S3
 */
export const s3RemovePage = async (
  options: S3RemovePageOptions
): Promise<boolean> => {
  const s3 = new S3Client({
    region: options.region || "us-east-1",
    maxAttempts: 3
  });

  const s3BasePath = options.basePath
    ? `${options.basePath.replace(/^\//, "")}/`
    : "";
  const { htmlKey, jsonKey } = getPageKeys(options.uri, options.buildId);

  const s3JsonParams = {
    Bucket: options.bucketName,
    Key: `${s3BasePath}${jsonKey}`
  };

  const s3HtmlParams = {
    Bucket: options.bucketName,
    Key: `${s3BasePath}${htmlKey}`
  };

  try {
    await Promise.all([
      s3.send(new DeleteObjectCommand(s3JsonParams)),
      s3.send(new DeleteObjectCommand(s3HtmlParams))
    ]);
  } catch (e) {
    return false;
  }

  return true;
};
