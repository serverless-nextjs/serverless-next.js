# Serverless Nextjs Plugin

A serverless custom plugin to deploy nextjs serverless pages.

The plugin targets Next-8 serverless mode. See https://nextjs.org/blog/next-8/#serverless-nextjs

## Motivation

Although next-8 [official support](https://nextjs.org/blog/next-8/#serverless-nextjs) for serverless is great, it doesn't work out of the box with AWS Lambdas, instead, next provides a low level API which should be enough to use to support different serverless platforms.

Nextjs serverless page handler signature:

`export function render(req: http.IncomingMessage, res: http.ServerResponse) => void`

AWS Lambda handler:

`exports.myHandler = function(event, context, callback) {...}`

This plugin adds a compat layer between the nextjs page and aws lambda at build time:

```
const page = require(".next/serverless/pages/index.js");

module.exports.render = (event, context, callback) => {
  const { req, res } = map(event, callback);
  page.render(req, res);
};
```

## Getting started

In your `serverless.yml` configure the plugin:

```
custom:
  serverless-nextjs:
    nextBuildDir: build
    staticAssetsBucket: my-bucket-name
```

- `nextBuildDir` maps to the `distDir` in your `next.config.js`. Is recommended to use a dir like build to avoid using dot directories (.next) in the Lambda as it may cause problems.
- `staticAssetsBucket` bucket name to deploy the next application static assets. Maps to `assetPrefix` in your `next.config.js`.

E.g.

_serverless.yml_

```
custom:
  serverless-nextjs:
    nextBuildDir: build
    staticAssetsBucket: my-bucket
```

_next.config.js_

```
module.exports = {
  target: "serverless",
  distDir: "build",
  assetPrefix: "https://s3.amazonaws.com/my-bucket"
};
```

## TODO

- [ ] Add full working example
- [ ] Maybe add support to pick configuration from next.config.js directly
