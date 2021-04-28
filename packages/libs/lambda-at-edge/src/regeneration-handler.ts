import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import { OriginRequestDefaultHandlerManifest } from "./types";
import { S3Client } from "@aws-sdk/client-s3";
import { buildS3RetryStrategy } from "./s3/s3RetryStrategy";

export const handler: AWSLambda.SQSHandler = async (event) => {
  await Promise.all(
    event.Records.map(async (record) => {
      const bucketName = record.messageAttributes.BucketName?.stringValue;
      const bucketRegion = record.messageAttributes.BucketRegion?.stringValue;
      const manifestString = record.messageAttributes.Manifest?.stringValue;
      const basePath = record.messageAttributes.BasePath?.stringValue;
      const cloudFrontEventRequestString =
        record.messageAttributes.CloudFrontEventRequest?.stringValue;
      if (
        !bucketName ||
        !bucketRegion ||
        !cloudFrontEventRequestString ||
        !manifestString
      ) {
        throw new Error(
          "Expected BucketName, BucketRegion, CloudFrontEventRequest & EnableHTTPCompression message attributes"
        );
      }
      const cloudFrontEventRequest: AWSLambda.CloudFrontRequest = JSON.parse(
        cloudFrontEventRequestString
      );
      const manifest: OriginRequestDefaultHandlerManifest = JSON.parse(
        manifestString
      );

      const s3 = new S3Client({
        region: cloudFrontEventRequest.origin?.s3?.region,
        maxAttempts: 3,
        retryStrategy: await buildS3RetryStrategy()
      });

      const { req, res } = lambdaAtEdgeCompat(
        { request: cloudFrontEventRequest },
        { enableHTTPCompression: manifest.enableHTTPCompression }
      );

      const baseKey = cloudFrontEventRequest.uri
        .replace(/^\//, "")
        .replace(/\.(json|html)$/, "")
        .replace(/^_next\/data\/[^\/]*\//, "");

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const page = require(`./pages/${baseKey}`);

      const jsonKey = `_next/data/${manifest.buildId}/${baseKey}.json`;
      const htmlKey = `static-pages/${manifest.buildId}/${baseKey}.html`;

      const { renderOpts, html } = await page.renderReqToHTML(
        req,
        res,
        "passthrough"
      );

      const s3BasePath = basePath ? `${basePath.replace(/^\//, "")}/` : "";
      const s3JsonParams = {
        Bucket: bucketName,
        Key: `${s3BasePath}${jsonKey}`,
        Body: JSON.stringify(renderOpts.pageData),
        ContentType: "application/json",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };

      const s3HtmlParams = {
        Bucket: bucketName,
        Key: `${s3BasePath}${htmlKey}`,
        Body: html,
        ContentType: "text/html",
        CacheControl: "public, max-age=0, s-maxage=2678400, must-revalidate"
      };

      const { PutObjectCommand } = await import(
        "@aws-sdk/client-s3/commands/PutObjectCommand"
      );
      await Promise.all([
        s3.send(new PutObjectCommand(s3JsonParams)),
        s3.send(new PutObjectCommand(s3HtmlParams))
      ]);
    })
  );
};
