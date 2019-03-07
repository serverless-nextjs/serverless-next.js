# Serverless Nextjs Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin)
[![npm version](https://badge.fury.io/js/serverless-nextjs-plugin.svg)](https://badge.fury.io/js/serverless-nextjs-plugin)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-nextjs-plugin/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-nextjs-plugin?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

A [serverless framework](https://serverless.com/) plugin to deploy nextjs apps.

The plugin targets [Next 8 serverless mode](https://nextjs.org/blog/next-8/#serverless-nextjs)

## Contents

- [Motivation](#motivation)
- [Getting Started](#getting-started)
- [Next config](#next-configuration)
- [Deploying](#deploying)
- [Deploying a single page](#deploying-a-single-page)
- [Examples](#examples)

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

## Getting started

### Installing

`npm install --save-dev serverless-nextjs-plugin`

The plugin only needs to know where your `next.config.js` file is located. Using your next configuration it will automatically build the application and compile the pages using the target: `serverless`.

Note it expects `nextConfigDir` to be a directory and not the actual file path.

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
```

You can exclude everything. The plugin makes sure the page handlers are included in the artifacts.

## Next configuration

```js
module.exports = {
  assetPrefix: "https://s3.amazonaws.com/your-bucket-name"
};
```

| Config Key               | Description                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| assetPrefix _(Optional)_ | When using a [valid bucket URL](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro) the plugin will create a new S3 Bucket using the parsed name. On deployment, static assets will be uploaded to the bucket provisioned. |

## Deploying

`serverless deploy`

When running `serverless deploy` all your next pages will be automatically compiled, packaged and deployed.

The Lambda functions created for each page have by default the following configuration:

```yml
handler: /path/to/page/handler.render
events:
  - http:
      path: pageName # home, about, etc.
      method: get
```

If you need to change the default configuration, such as `memorySize`, `timeout` etc. use the top level `provider` which will override the functions configuration. For example, to change the memorySize to 512MB:

```yml
provider:
  name: aws
  runtime: nodejs8.10
  memorySize: 512
  ...
```

See [this](https://serverless.com/framework/docs/providers/aws/guide/functions#configuration) for more information.

## Deploying a single page

If you need to deploy just one of your pages, simply run:

`serverless deploy function --function pageFunctionName`

where `pageFunctionName` will be the page file name + `"Page"`. For example, to deploy `pages/home.js`, you can run:

`serverless deploy function --function homePage`

## Examples

See the `examples/` directory.
