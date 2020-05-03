import AWS from "aws-sdk";
import { Credentials } from "./lib/s3";
declare type UploadStaticAssetsOptions = {
    bucketName: string;
    nextConfigDir: string;
    credentials: Credentials;
};
declare const uploadStaticAssets: (options: UploadStaticAssetsOptions) => Promise<AWS.S3.ManagedUpload.SendData[]>;
export default uploadStaticAssets;
