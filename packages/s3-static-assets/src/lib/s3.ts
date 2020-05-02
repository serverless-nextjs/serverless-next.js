import getMimeType from "./getMimeType";
import fse from "fs-extra";
import AWS from "aws-sdk";

type S3ClientFactoryOptions = {
  bucketName: string;
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

export default ({ bucketName }: S3ClientFactoryOptions): S3Client => {
  const s3 = new AWS.S3();

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
