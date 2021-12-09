#!/usr/bin/env node

import * as AWS from "aws-sdk";
import { calculateHandlerSizes } from "./handler-size-utils";

const uploadHandlerSizesToS3 = async (
  sizes: Record<string, any>
): Promise<void> => {
  const s3 = new AWS.S3();
  await s3
    .upload({
      Bucket: "serverless-nextjs-handler-sizes",
      Key: `sizes-github-sha-${process.env.GITHUB_SHA}.json`,
      Body: JSON.stringify(sizes, null, 2),
      ContentType: "application/json",
      CacheControl: "public, max-age=2592000, immutable"
    })
    .promise();
};

console.info("Calculate all uncompressed handler sizes");

const sizes: Record<string, any> = calculateHandlerSizes();

console.log("Calculated sizes: " + JSON.stringify(sizes, null, 2));

uploadHandlerSizesToS3(sizes)
  .then(() => {
    console.info("Uploaded handler sizes to S3 successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
