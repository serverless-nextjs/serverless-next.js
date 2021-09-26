import {
  ObjectResponse,
  PlatformClient,
  StorePageOptions,
  TriggerStaticRegenerationOptions,
  RegenerationEvent
} from "@sls-next/core";
import type { Readable } from "stream";

/**
 * Client to access pages/files, store pages to S3 and trigger SQS regeneration.
 */
export class AwsPlatformClient implements PlatformClient {
  private readonly bucketRegion: string;
  private readonly bucketName: string;
  private readonly regenerationQueueRegion: string | undefined;
  private readonly regenerationQueueName: string | undefined;

  constructor(
    bucketName: string,
    bucketRegion: string,
    regenerationQueueName: string | undefined,
    regenerationQueueRegion: string | undefined
  ) {
    this.bucketName = bucketName;
    this.bucketRegion = bucketRegion;
    this.regenerationQueueName = regenerationQueueName;
    this.regenerationQueueRegion = regenerationQueueRegion;
  }

  public async getObject(pageKey: string): Promise<ObjectResponse> {
    const { S3Client } = await import("@aws-sdk/client-s3/S3Client");
    const s3 = new S3Client({
      region: this.bucketRegion,
      maxAttempts: 3
    });
    const { GetObjectCommand } = await import(
      "@aws-sdk/client-s3/commands/GetObjectCommand"
    );
    // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
    const getStream = await import("get-stream");
    const s3Params = {
      Bucket: this.bucketName,
      Key: pageKey
    };

    let s3StatusCode;
    let bodyString;
    let s3Response;

    try {
      s3Response = await s3.send(new GetObjectCommand(s3Params));
      bodyString = await getStream.default(s3Response.Body as Readable);
      s3StatusCode = s3Response.$metadata.httpStatusCode ?? 200; // assume OK if not set, but it should be
    } catch (e: any) {
      s3StatusCode = e.statusCode;

      return {
        body: undefined,
        headers: {},
        statusCode: s3StatusCode
      };
    }

    return {
      body: bodyString,
      headers: {
        "Cache-Control": s3Response.CacheControl,
        "Content-Disposition": s3Response.ContentDisposition,
        "Content-Type": s3Response.ContentType,
        "Content-Language": s3Response.ContentLanguage,
        "Content-Length": s3Response.ContentLength?.toString(),
        "Content-Encoding": s3Response.ContentEncoding,
        "Content-Range": s3Response.ContentRange,
        ETag: s3Response.ETag,
        LastModified: s3Response.LastModified?.getTime().toString(),
        "Accept-Ranges": s3Response.AcceptRanges
      },
      statusCode: s3StatusCode
    };
  }

  public async storePage(
    options: StorePageOptions
  ): Promise<{ cacheControl: string | undefined; expires: Date | undefined }> {
    const { S3Client } = await import("@aws-sdk/client-s3/S3Client");

    const s3 = new S3Client({
      region: this.bucketRegion,
      maxAttempts: 3
    });

    const s3BasePath = options.basePath
      ? `${options.basePath.replace(/^\//, "")}/`
      : "";
    const baseKey = options.uri
      .replace(/^\/$/, "index")
      .replace(/^\//, "")
      .replace(/\.(json|html)$/, "")
      .replace(/^_next\/data\/[^\/]*\//, "");
    const jsonKey = `_next/data/${options.buildId}/${baseKey}.json`;
    const htmlKey = `static-pages/${options.buildId}/${baseKey}.html`;
    const cacheControl = options.revalidate
      ? undefined
      : "public, max-age=0, s-maxage=2678400, must-revalidate";
    const expires = options.revalidate
      ? new Date(new Date().getTime() + 1000 * options.revalidate)
      : undefined;

    const s3JsonParams = {
      Bucket: this.bucketName,
      Key: `${s3BasePath}${jsonKey}`,
      Body: JSON.stringify(options.pageData),
      ContentType: "application/json",
      CacheControl: cacheControl,
      Expires: expires
    };

    const s3HtmlParams = {
      Bucket: this.bucketName,
      Key: `${s3BasePath}${htmlKey}`,
      Body: options.html,
      ContentType: "text/html",
      CacheControl: cacheControl,
      Expires: expires
    };

    const { PutObjectCommand } = await import(
      "@aws-sdk/client-s3/commands/PutObjectCommand"
    );
    await Promise.all([
      s3.send(new PutObjectCommand(s3JsonParams)),
      s3.send(new PutObjectCommand(s3HtmlParams))
    ]);

    return {
      cacheControl,
      expires
    };
  }

  public async triggerStaticRegeneration(
    options: TriggerStaticRegenerationOptions
  ): Promise<{ throttle: boolean }> {
    if (!this.regenerationQueueRegion || !this.regenerationQueueName) {
      throw new Error("SQS regeneration queue region and name is not set.");
    }

    const { SQSClient, SendMessageCommand } = await import(
      "@aws-sdk/client-sqs"
    );
    const sqs = new SQSClient({
      region: this.regenerationQueueRegion,
      maxAttempts: 1
    });

    const regenerationEvent: RegenerationEvent = {
      pagePath: options.pagePath,
      basePath: options.basePath,
      pageKey: options.pageKey,
      storeName: this.bucketName,
      storeRegion: this.bucketRegion,
      queueName: this.regenerationQueueName,
      queueRegion: this.regenerationQueueRegion
    };

    try {
      const crypto = await import("crypto");
      // Hashed URI for messageGroupId to allow for long URIs, as SQS has limit of 128 characters
      // MD5 is used since this is only used for grouping purposes
      const hashedUri = crypto
        .createHash("md5")
        .update(options.requestUri)
        .digest("hex");

      await sqs.send(
        new SendMessageCommand({
          QueueUrl: `https://sqs.${this.regenerationQueueRegion}.amazonaws.com/${this.regenerationQueueName}`,
          MessageBody: JSON.stringify(regenerationEvent), // This is not used, however it is a required property
          // We only want to trigger the regeneration once for every previous
          // update. This will prevent the case where this page is being
          // requested again whilst its already started to regenerate.
          MessageDeduplicationId:
            options.eTag ??
            (options.lastModified
              ? new Date(options.lastModified).getTime().toString()
              : new Date().getTime().toString()),
          // Only deduplicate based on the object, i.e. we can generate
          // different pages in parallel, just not the same one
          MessageGroupId: hashedUri
        })
      );
      return { throttle: false };
    } catch (error: any) {
      if (error.code === "RequestThrottled") {
        return { throttle: true };
      } else {
        throw error;
      }
    }
  }
}
