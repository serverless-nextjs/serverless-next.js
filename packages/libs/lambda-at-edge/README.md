### AWS Lambda@Edge library to help you deploy serverless next.js applications to CloudFront

This library was created to decouple the core logic of deploying serverless rendered next.js applications on the Cloud agnostic of a specific provider. In other words, this library could be used to deploy via serverles components, AWS CDK, or any other providers you'd like.

## Usage

```
const path = require('path');
const { Builder } = require("@sls-next/lambda-at-edge");

const nextConfigDir = '/dir/to/my/nextapp';
const outputDir = path.join(nextConfigDir, ".serverless_nextjs");

const builder = new Builder(
  nextConfigDir,
  outputDir,
  {
    cmd: './node_modules/.bin/next',
    cwd: process.cwd(),
    env: {},
    args: ['build']
  }
);

await builder.build();
```

After running the above, the output directory will contain the Lambda@Edge handlers necessary to server side render at the edge.

```
/dir/to/my/next-app/.serverless_nextjs/

 > default-lambda
   > manifest.json
   > pages/
   > node_modules/next-aws-cloudfront/index.js
   > index.js # handler

 > api-lambda
   > manifest.json
   > pages/api/
   > node_modules/next-aws-cloudfront/index.js
   > index.js # handler
```

The handlers need to be attached to the `origin-request` trigger of CloudFront. The `api-lambda` edge function should be attached to a CloudFront behaviour that only triggers in the event of `/api/*` requests.

### TODO:

- Provisioning and configuration of the CloudFront distribution
- Create a separate utility to clean up unused Lambda@Edge functions that were previously attached to a CloudFront distribution
