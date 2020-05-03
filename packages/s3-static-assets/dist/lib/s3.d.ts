import AWS from "aws-sdk";
declare type S3ClientFactoryOptions = {
    bucketName: string;
    credentials: Credentials;
};
declare type UploadFileOptions = {
    filePath: string;
    cacheControl?: string;
    s3Key?: string;
};
export declare type S3Client = {
    uploadFile: (options: UploadFileOptions) => Promise<AWS.S3.ManagedUpload.SendData>;
};
export declare type Credentials = {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
};
declare const _default: ({ bucketName, credentials }: S3ClientFactoryOptions) => Promise<S3Client>;
export default _default;
