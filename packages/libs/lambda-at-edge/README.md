### AWS Lambda@Edge library to help you deploy serverless next.js applications to CloudFront

This library was created to decouple the core logic of deploying serverless rendered next.js applications on the Cloud agnostic of a specific provider. In other words, this library could be used to deploy via serverles components, AWS CDK, or any other providers you'd like.

## Usage

```
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

### TODO:

- Provisioning and configuration of the CloudFront distribution
- Create a separate utility to clean up unused Lambda@Edge functions that were previously attached to a CloudFront distribution
