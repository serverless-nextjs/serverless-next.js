#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as AWS from "aws-sdk";

type HandlerConfiguration = {
  path: string;
  handlers: Record<string, Record<string, string>>;
};

const PLATFORM_CONFIGS: Record<string, HandlerConfiguration> = {
  "Lambda@Edge": {
    path: "packages/libs/lambda-at-edge",
    handlers: {
      "Default Lambda": {
        Standard: "dist/default-handler/standard",
        Minified: "dist/default-handler/minified"
      },
      "API Lambda": {
        Standard: "dist/api-handler/standard",
        Minified: "dist/api-handler/minified"
      },
      "Image Lambda": {
        Standard: "dist/image-handler/standard",
        Minified: "dist/image-handler/minified"
      },
      "Regeneration Lambda": {
        Standard: "dist/regeneration-handler/standard",
        Minified: "dist/regeneration-handler/minified"
      }
    }
  }
};

const getDirectorySizeInKilobytes = (
  directoryPath: string
): number | undefined => {
  let size = 0;

  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      size += fs.statSync(path.join(directoryPath, file)).size;
    });
    return Math.round(size / 1024);
  } else {
    return undefined;
  }
};

const uploadHandlerSizesToS3 = async (
  sizes: Record<string, any>
): Promise<void> => {
  const s3 = new AWS.S3();
  await s3
    .upload({
      Bucket: "serverless-nextjs-handler-sizes",
      Key: `sizes-github-sha-${process.env.GITHUB_SHA}.json`,
      Body: JSON.stringify(sizes, null, 2),
      ContentType: "application/json"
    })
    .promise();
};

console.info("Calculate all uncompressed handler sizes");

const sizes: Record<string, any> = {};

for (const [platform, platformConfig] of Object.entries(PLATFORM_CONFIGS)) {
  sizes[platform] = {};
  const packagePath = platformConfig.path;
  for (const [handler, handlerConfig] of Object.entries(
    platformConfig.handlers
  )) {
    sizes[platform][handler] = {};
    for (const [handlerType, handlerPath] of Object.entries(handlerConfig)) {
      const relativePath = path.join(packagePath, handlerPath);
      sizes[platform][handler][handlerType] =
        getDirectorySizeInKilobytes(relativePath);
    }
  }
}

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
