import { GetObjectCommand } from "@aws-sdk/client-s3/commands/GetObjectCommand";
import { PutObjectCommand } from "@aws-sdk/client-s3/commands/PutObjectCommand";
import { S3Client } from "@aws-sdk/client-s3/S3Client";

module.exports = {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
};
