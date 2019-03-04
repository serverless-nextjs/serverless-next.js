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

Configure your `next.config.js` like this:

```js
module.exports = {
  assetPrefix: "https://s3.amazonaws.com/your-bucket-name"
};
```

`assetPrefix: "https://s3.amazonaws.com/your-bucket-name"`

Other [valid bucket URLs](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro) are also fine.

The plugin will parse the bucket name from the `assetPrefix` and will create an S3 bucket using the parsed name. The first time the serverless stack is provisioned, it is assumed there isn't a bucket with this name already, so make sure you don't have a bucket with that name already in your amazon account. On deployment, the plugin will upload the next static assets to your bucket. Note that bucket names must be globally unique.

After doing the above, simply run:

`serverless deploy`

You should now have one API Gateway GET/ endpoint per next page 🎉

## Examples

See the `examples/` directory.

## Roadmap

- More examples
- CloudFront support
- Mitigation of lambda cold starts
