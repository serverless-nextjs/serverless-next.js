import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3/S3Client";
import { CloudFrontResponse, CloudFrontResultResponse } from "aws-lambda";
import type { Readable } from "stream";

import { OriginRequestDefaultHandlerManifest } from "../../types";

/**
 * Return a 404 response.
 *
 * @param response
 * @param basePath
 * @param manifest
 * @param s3
 * @param bucketName
 */
export async function createNotFoundResponse(
  response: CloudFrontResponse,
  basePath: string,
  manifest: OriginRequestDefaultHandlerManifest,
  s3: S3Client,
  bucketName: string
): Promise<CloudFrontResultResponse> {
  const s3Key = `${(basePath || "").replace(/^\//, "")}${
    basePath === "" ? "" : "/"
  }static-pages/${manifest.buildId}/404.html`;

  const getStream = await import("get-stream");

  const s3Params = {
    Bucket: bucketName,
    Key: s3Key
  };

  const { Body, CacheControl } = await s3.send(new GetObjectCommand(s3Params));
  const bodyString = await getStream.default(Body as Readable);

  const out = {
    status: "404",
    statusDescription: "Not Found",
    headers: {
      ...response.headers,
      "content-type": [
        {
          key: "Content-Type",
          value: "text/html"
        }
      ],
      "cache-control": [
        {
          key: "Cache-Control",
          value:
            CacheControl ??
            "public, max-age=0, s-maxage=2678400, must-revalidate"
        }
      ]
    },
    body: bodyString
  };
  return out;
}
