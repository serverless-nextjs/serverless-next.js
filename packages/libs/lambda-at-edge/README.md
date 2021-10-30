# @sls-next/lambda-at-edge
> Library to build and deploy Next.js apps for AWS Lambda@Edge

This library uses the handlers provided by `@sls-next/core` and wraps them with a Lambda@Edge/CloudFront-compatible layer.

## Usage

```ts
const path = require('path');
const { Builder } = require("@sls-next/lambda-at-edge");

const nextConfigPath = '/path/to/my/nextapp';
const outputDir = path.join(nextConfigPath, ".serverless_nextjs");

const builder = new Builder(
  nextConfigPath,
  outputDir,
  {
    cmd: './node_modules/.bin/next',
    cwd: process.cwd(),
    env: {},
    args: ['build'],
    minifyHandlers: true,
    // it is recommended to let your CF distribution do the compression as per the docs - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html
    // however there have been issues in the past where CF doesn't compress lambda@edge responses, so we provide our own implementation in case is needed
    enableHTTPCompression: false
  }
);

await builder.build()
    .then(() => {
      console.log("Application built successfully!");
    })
    .catch((e) => {
      console.log("Could not build app due the exception: ", e);
      process.exit(1);
    });
```

You can configure more options regarding building process. Configurable inputs you can find in 'build.ts' file ('packages/libs/lambda-at-edge/src/build.ts'). If you want to see debug logs during building, use 'await builder.build(true)' instead.
After running the above, the output directory will contain the Lambda@Edge handlers necessary to server side render at the edge.

```
/dir/to/my/next-app/.serverless_nextjs/

 > default-lambda
   > manifest.json
   > routes-manifest.json
   > prerender-manifest.json
   > pages/
   > index.js # handler

 > api-lambda
   > manifest.json
   > routes-manifest.json
   > pages/api/
   > index.js # handler

 > image-lambda
   > manifest.json
   > routes-manifest.json
   > images-manifest.json
   > node_modules/...
   > index.js # handler
```

The handlers need to be attached to the `origin-request` trigger of CloudFront.
The `api-lambda` edge function should be attached to a CloudFront behaviour that only triggers in the event of `/api/*` requests.
The `image-lambda` edge function should be attached to a CloudFront behaviour that only triggers in the event of `_next/image*` requests.

For full usage docs, please refer to (TBA).

## Architecture
Once built and packaged, the app consists of the following components:

* `default-lambda` (v2): handles page and API requests.
* `default-lambda` (v1): handles page requests only.
* `api-lambda` (legacy v1 handlers only): handles API requests.
* `regeneration-lambda`: handles regeneration requests used for ISR.
* `image-lambda`: handles image optimization requests.
* `assets`: all static assets used by your app.

## Infrastructure
You will need the following infrastructure to deploy your app:

* AWS Lambda@Edge
* AWS CloudFront
* AWS API Gateway
* AWS S3 Bucket
* AWS SQS Queue (if you are using ISR)
* additional roles, permissions, etc.

## Deployment

Currently, you will need to deploy via the Serverless Components deployer, `@sls-next/serverless-component`. We also provide a CDK construct at `@sls-next/nextjs-cdk-construct`.

If you'd like to write your own custom deployment logic, please see the CDK construct or legacy Serverless Components deployer to see an example of all the infrastructure you need to setup.

## Limitations

* Lambda@Edge limitations apply: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-functions-restrictions.html. Most notably, there is a 1 MB response size limit, which could especially affect static files.
* CloudFront limitations apply: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html
* The image handler only serves image optimization requests. It cannot redirect, rewrite or add headers (yet).
* In v1 handlers (legacy), the default, API and image handlers are separate, so you cannot rewrite from default routes -> image routes nor rewrite between default routes and API routes.
* In v2 handlers, the default and image handlers are separate, so you cannot rewrite from default routes -> image routes.

## Acknowledgements

Special thanks for Daniel Conde Marin for the initial implementation.
