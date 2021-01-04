import { S3Client } from "@aws-sdk/client-s3/S3Client";
import { PutObjectCommand, PutObjectCommandOutput } from "@aws-sdk/client-s3";

interface S3ServiceOptions {
  bucketName?: string;
  domainName?: string;
  region?: string;
}

class S3Header {
  header: PutObjectCommandOutput;

  constructor(header: PutObjectCommandOutput) {
    this.header = header;
  }

  getETag(): string | undefined {
    return this.header.ETag && this.header.ETag.replace(/"/g, "");
  }
}

export class S3Service {
  constructor(
    private readonly client: S3Client,
    private readonly options: S3ServiceOptions = {}
  ) {}

  public async getHeader(key: string): Promise<S3Header> {
    if (!this.options.bucketName) {
      throw new Error("Bucket name not configured");
    }
    if (!key) {
      throw new Error("Key is not provided");
    }
    return new S3Header(
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.options.bucketName,
          Key: key
        })
      )
    );
  }

  public async putObject(key: string, body: string): Promise<void> {
    if (!this.options.bucketName) {
      throw new Error("Bucket name not configured");
    }
    if (!body) {
      throw new Error("Data is not provided");
    }
    await this.client.send(
      new PutObjectCommand({
        Key: key,
        Body: body,
        Bucket: this.options.bucketName,
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      })
    );
  }
}
