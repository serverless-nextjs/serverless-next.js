import getMimeType from "./getMimeType";
import fse from "fs-extra";
import AWS from "aws-sdk";

type S3ClientFactoryOptions = {
  bucketName: string;
  credentials: Credentials;
};

type UploadFileOptions = {
  filePath: string;
  cacheControl?: string;
  s3Key?: string;
};

export type S3Client = {
  uploadFile: (
    options: UploadFileOptions
  ) => Promise<AWS.S3.ManagedUpload.SendData>;
};

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export default async ({
  bucketName,
  credentials
}: S3ClientFactoryOptions): Promise<S3Client> => {
  let s3 = new AWS.S3({ ...credentials });

  try {
    const { Status } = await s3
      .getBucketAccelerateConfiguration({
        Bucket: bucketName
      })
      .promise();

    if (Status === "Enabled") {
      s3 = new AWS.S3({ ...credentials, useAccelerateEndpoint: true });
    }
  } catch (err) {
    console.warn(
      "Checking for bucket acceleration failed, falling back to non-accelerated S3 client"
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
    }
  };
};
