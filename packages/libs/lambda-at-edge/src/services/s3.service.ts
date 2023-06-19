import { S3Client } from "@aws-sdk/client-s3/S3Client";
import {
  PutObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput
} from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3/commands/GetObjectCommand";
import { DeleteObjectCommand } from "@aws-sdk/client-s3/commands/DeleteObjectCommand";

interface S3ServiceOptions {
  bucketName?: string;
  domainName?: string;
  region?: string;
}

class S3Header {
  header: HeadObjectCommandOutput;

  constructor(header: HeadObjectCommandOutput) {
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

    try {
      const headOutput = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.options.bucketName,
          Key: key
        })
      );
      return new S3Header(headOutput);
    } catch (e) {
      return new S3Header({ $metadata: {}, ETag: undefined });
    }
  }

  public async deleteObject(key: string): Promise<void> {
    if (!this.options.bucketName) {
      throw new Error("Bucket name not configured");
    }
    if (!key) {
      throw new Error("Key is not provided");
    }
    await this.client.send(
      new DeleteObjectCommand({
        Key: key,
        Bucket: this.options.bucketName
      })
    );
  }

  public async putObject(
    key: string,
    body: string,
    contentType: string,
    cacheControl?: string
  ): Promise<void> {
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
        ContentType: contentType,
        CacheControl:
          cacheControl ?? "public, max-age=0, s-maxage=2678400, must-revalidate"
      })
    );
  }

  public async getObject(key: string): Promise<any> {
    if (!this.options.bucketName) {
      throw new Error("Bucket name not configured");
    }

    const data = new Promise(async (resolve, reject) => {
      const getObjectCommand = new GetObjectCommand({
        Key: key,
        Bucket: this.options.bucketName
      });

      try {
        const response = await this.client.send(getObjectCommand);

        // Store all of data chunks returned from the response data stream
        // into an array then use Array#join() to use the returned contents as a String
        const responseDataChunks: any[] = [];

        // Attach a 'data' listener to add the chunks of data to our array
        // Each chunk is a Buffer instance
        // @ts-ignore
        response.Body.on("data", (chunk) => responseDataChunks.push(chunk));

        // Once the stream has no more data, join the chunks into a string and return the string
        // @ts-ignore
        response.Body.once("end", () => resolve(responseDataChunks.join("")));
      } catch (err) {
        // Handle the error or throw
        return reject(err);
      }
    });
    return data;
  }
}
