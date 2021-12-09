import getMimeType from "./getMimeType";
import fse from "fs-extra";
import AWS, { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { ObjectList } from "aws-sdk/clients/s3";

type S3ClientFactoryOptions = {
  bucketName: string;
  bucketRegion: string;
  credentials: Credentials;
};

type UploadFileOptions = {
  filePath: string;
  cacheControl?: string;
  s3Key?: string;
};

type DeleteFilesByPatternOptions = {
  prefix: string;
  pattern: RegExp;
  excludePattern?: RegExp;
};

type GetFileOptions = {
  key: string;
};

export type S3Client = {
  uploadFile: (
    options: UploadFileOptions
  ) => Promise<AWS.S3.ManagedUpload.SendData>;
  /**
   * Delete all files in S3 given the pattern.
   * @param options
   */
  deleteFilesByPattern: (options: DeleteFilesByPatternOptions) => Promise<void>;
  /**
   * Get file in S3 given the key and read it into a string.
   * @param options
   */
  getFile: (options: GetFileOptions) => Promise<string | undefined>;
};

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

const getS3RegionalEndpoint = (bucketRegion: string): string => {
  // TODO: doesn't cover all endpoints but should be majority.
  // We should ugprade to AWS SDK JS v3 so we don't need to manually manage.
  return (
    `https://s3.${bucketRegion}.amazonaws.com` +
    `${bucketRegion.startsWith("cn-") ? ".cn" : ""}`
  );
};

export default async ({
  bucketName,
  bucketRegion,
  credentials
}: S3ClientFactoryOptions): Promise<S3Client> => {
  let s3 = new AWS.S3({
    ...credentials,
    region: bucketRegion,
    endpoint: getS3RegionalEndpoint(bucketRegion),
    s3BucketEndpoint: false
  });

  try {
    const { Status } = await s3
      .getBucketAccelerateConfiguration({
        Bucket: bucketName
      })
      .promise();

    if (Status === "Enabled") {
      s3 = new AWS.S3({
        ...credentials,
        region: bucketRegion,
        endpoint: getS3RegionalEndpoint(bucketRegion),
        s3BucketEndpoint: false,
        useAccelerateEndpoint: true
      });
    }
  } catch (err: any) {
    console.warn(
      `Checking for bucket acceleration failed, falling back to non-accelerated S3 client. Err: ${err.message}`
    );
  }

  return {
    uploadFile: async (
      options: UploadFileOptions
    ): Promise<AWS.S3.ManagedUpload.SendData> => {
      const { filePath, cacheControl, s3Key } = options;

      const fileBody = await fse.readFile(filePath);

      return s3
        .upload({
          Bucket: bucketName,
          Key: s3Key || filePath,
          Body: fileBody,
          ContentType: getMimeType(filePath),
          CacheControl: cacheControl || undefined
        })
        .promise();
    },
    deleteFilesByPattern: async (
      options: DeleteFilesByPatternOptions
    ): Promise<void> => {
      const { prefix, pattern, excludePattern } = options;

      // 1. Get all objects by given prefix and matching the pattern, but excluding a pattern.
      const foundKeys: string[] = [];
      let continuationToken = undefined; // needed to paginate through all objects

      while (true) {
        const data: PromiseResult<S3.ListObjectsV2Output, AWSError> = await s3
          .listObjectsV2({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken
          })
          .promise();

        // Push all objects
        const contents: ObjectList = data.Contents ?? [];
        contents.forEach(function (content) {
          if (content.Key) {
            const key = content.Key;

            // Match pattern and does not match exclude pattern
            if (
              pattern.test(key) &&
              (!excludePattern || !excludePattern.test(key))
            ) {
              foundKeys.push(content.Key);
            }
          }
        });

        // Continue listing since ListObjectsV2 gets up to 1000 objects at a time
        if (data.IsTruncated) {
          continuationToken = data.NextContinuationToken;
        } else {
          break;
        }
      }

      const maxKeysToDelete = 1000; // From https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html

      // 2. Delete all the objects in batch mode
      let start = 0;
      while (start < foundKeys.length) {
        const objects = [];
        for (
          let i = start;
          i < start + maxKeysToDelete && i < foundKeys.length;
          i++
        ) {
          objects.push({
            Key: foundKeys[i]
          });
        }

        await s3
          .deleteObjects({
            Bucket: bucketName,
            Delete: {
              Objects: objects
            }
          })
          .promise();

        start += maxKeysToDelete;
      }
    },
    getFile: async (options: GetFileOptions): Promise<string | undefined> => {
      try {
        const data = await s3
          .getObject({
            Bucket: bucketName,
            Key: options.key
          })
          .promise();

        return data.Body?.toString("utf-8");
      } catch (e: any) {
        if (e.code === "NoSuchKey") {
          return undefined;
        }
      }
    }
  };
};
