# Serverless Nextjs Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin)
[![npm version](https://badge.fury.io/js/serverless-nextjs-plugin.svg)](https://badge.fury.io/js/serverless-nextjs-plugin)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-nextjs-plugin/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-nextjs-plugin?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

A [serverless framework](https://serverless.com/) plugin to deploy nextjs apps.

The plugin targets [Next 8 serverless mode](https://nextjs.org/blog/next-8/#serverless-nextjs)

## Motivation

Next 8 released [official support](https://nextjs.org/blog/next-8/#serverless-nextjs) for serverless! It doesn't work out of the box with AWS Lambdas, instead, next provides a low level API which this plugin uses to deploy the serverless pages.

Nextjs serverless page handler signature:

`exports.render = function(req, res) => {...}`

AWS Lambda handler:

`exports.handler = function(event, context, callback) {...}`

A compat layer between the nextjs page bundles and AWS Lambda is added at build time:

```js
const page = require(".next/serverless/pages/somePage.js");

module.exports.render = (event, context, callback) => {
  const { req, res } = compatLayer(event, callback);
  page.render(req, res);
};
```

### Also benefit from

- Automatic next builds
- Dynamic creation of serverless functions for each page.
- S3 Bucket provisioning for static assets. Relies on [assetPrefix](https://github.com/zeit/next.js/#cdn-support-with-asset-prefix).

## Getting started

### Installing

`npm install --save-dev serverless-nextjs-plugin`

The plugin only needs to know where your `next.config.js` file is located. Note it expects the directory and not the actual file path.

```
nextApp
│   next.config.js
│   serverless.yml
└───pages
│   │   home.js
│   │   about.js
│   │   admin.js
```

Edit the serverless.yml and add:

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: "./"

package:
  exclude:
    - ./**/*
  include:
    - sls-next-build/*
```

Include the pattern `sls-next-build/*` as this is where the plugin copies the compiled page handlers.

### Next configuration

```js
module.exports = {
  assetPrefix: "https://s3.amazonaws.com/your-bucket-name"
};
```

| Config Key               | Description                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| assetPrefix _(Optional)_ | When using a [valid bucket URL](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro) the plugin will create a new S3 Bucket using the parsed name. On deployment, static assets will be uploaded to the bucket. |

### Deploying

`serverless deploy`

You should now have one API Gateway GET/ endpoint per next page 🎉

## Examples

See the `examples/` directory.

