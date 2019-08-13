# Serverless Nextjs Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin)
[![Financial Contributors on Open Collective](https://opencollective.com/serverless-nextjs-plugin/all/badge.svg?label=financial+contributors)](https://opencollective.com/serverless-nextjs-plugin) [![npm version](https://badge.fury.io/js/serverless-nextjs-plugin.svg)](https://badge.fury.io/js/serverless-nextjs-plugin)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-nextjs-plugin/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-nextjs-plugin?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

A [serverless framework](https://serverless.com/) plugin to deploy nextjs apps.

The plugin targets [Next 8 serverless mode](https://nextjs.org/blog/next-8/#serverless-nextjs)

![demo](./demo.gif)

## Contents

- [Motivation](#motivation)
- [Getting Started](#getting-started)
- [Hosting static assets](#hosting-static-assets)
- [Serving static assets](#serving-static-assets)
- [Deploying](#deploying)
- [Overriding page configuration](#overriding-page-configuration)
- [Custom page routing](#custom-page-routing)
- [Custom error page](#custom-error-page)
- [Custom lambda handler](#custom-lambda-handler)
- [All plugin configuration options](#all-plugin-configuration-options)
- [Examples](#examples)
- [Caveats](#caveats)
- [Contributing](#contributing)

## Motivation

Next 8 released [official support](https://nextjs.org/blog/next-8/#serverless-nextjs) for serverless! It doesn't work out of the box with AWS Lambdas, instead, next provides a low level API which this plugin uses to deploy the serverless pages.

Nextjs serverless page handler signature:

```js
exports.render = function(req, res) => {...}
```

AWS Lambda handler:

```js
exports.handler = function(event, context, callback) {...}
```

A compat layer between the nextjs page bundles and AWS Lambda is added at build time:

```js
const compat = require("next-aws-lambda");
const page = require(".next/serverless/pages/somePage.js");

module.exports.render = (event, context, callback) => {
  compat(page)(event, context, callback);
};
```

## Getting started

### Installing

`npm install --save-dev serverless-nextjs-plugin`

Out of the box, the plugin won't require any configuration. If you need to override any defaults check [this](#all-plugin-configuration-options).

For example:

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

package:
  exclude:
    - ./**
```

You can exclude everything. The plugin makes sure the page handlers are included in the artifacts.

## Hosting static assets

If you don't want to manage uploading the next static assets yourself, like uploading them to a CDN, the plugin can do this for you by hosting the asset files on S3.

The easiest way is to use a [valid bucket URL](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro) in the `assetPrefix` field of your next configuration:

```js
// next.config.js
module.exports = {
  assetPrefix: "https://s3.amazonaws.com/your-bucket-name"
};
```

The plugin will create a new S3 Bucket using the parsed name. On deployment, static assets will be uploaded to the bucket provisioned.

Alternatively, if you just want the assets to get uploaded to S3, you can provide the bucket name via the plugin config:

```yml
# serverless.yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    assetsBucketName: "your-bucket-name"
```

## Serving static assets

Static files can be served by [following the NextJs convention](https://github.com/zeit/next.js/#static-file-serving-eg-images) of using a `static` and `public` folder.

From your code you can then reference those files with a `/static` URL:

```
function MyImage() {
  return <img src="/static/my-image.png" alt="my image" />
}

export default MyImage
```

To serve static files from the root directory you can add a folder called public and reference those files from the root, e.g: /robots.txt.

Note that for this to work, an S3 bucket needs to be provisioned as per [hosting-static-assets](#hosting-static-assets).

**For production deployments, enabling CloudFront is recommended:**

```yml
# serverless.yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    assetsBucketName: "your-bucket-name"
    cloudFront: true
```

By doing this, a CloudFront distribution will be created in front of your next application to serve any static assets from S3 and the pages from Api Gateway.

Note that deploying the stack for the first time will take considerably longer, as CloudFront takes time propagating the changes, typically 10 - 20mins.

You can provide your own configuration for the CloudFront distribution:

```yml
# serverless.yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    assetsBucketName: "your-bucket-name"
    cloudFront: ${file(cloudfront-override.yml)}
```

```yml
# cloudfront-override.yml
# e.g. add custom domain name
Properties:
  DistributionConfig:
    Aliases:
      - my.alias.com
    ViewerCertificate:
      AcmCertificateArn: arn:aws:acm:xxxx
      ...
```

The configuration provided will be merged onto the defaults in `packages/serverless-nextjs-plugin/resources/cloudfront.yml`.

## Deploying

`serverless deploy`

When running `serverless deploy` all your next pages will be automatically compiled, packaged and deployed.

The Lambda functions created for each page have by default the following configuration:

```yml
handler: /path/to/page/handler.render
events:
  - http:
      path: pageName # home, about, etc. Unless is the index page which is served at /
      method: get
  - http:
      path: pageName # home, about, etc. Unless is the index page which is served at /
      method: head
```

## Overriding page configuration

You may want to have a different configuration for one or more of your page functions. This is possible by setting the `pageConfig` key in the plugin config:

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    pageConfig:
      about:
        memorySize: 512 # default is 1024
      home:
        timeout: 10 # default is 6
```

If you need to change the default configuration, such as `memorySize`, `timeout` etc. use the top level `provider` which will override all the functions configuration. For example, to change the memorySize to 512MB:

```yml
provider:
  name: aws
  runtime: nodejs8.10
  memorySize: 512
  ...
```

You can also add configuration for all page functions by adding an asterisk entry (`*`) to `pageConfig`. This is particularly useful when you have other functions in your service (i.e. an `api`) aside from the page functions and you only want to apply configuration changes to the latter:

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    pageConfig:
      "*":
        layers:
          - arn:aws:lambda:${self:provider.region}:553035198032:layer:nodejs12:1
```

You can set any function property described [here](https://serverless.com/framework/docs/providers/aws/guide/functions#configuration).

## Custom page routing

The default page routes follow the same convention as next `useFileSystemPublicRoutes` documented [here](https://nextjs.org/docs/#routing).

E.g.

| page                        | path                |
| --------------------------- | ------------------- |
| pages/index.js              | /                   |
| pages/post.js               | /post               |
| pages/blog/index.js         | /blog               |
| pages/categories/uno/dos.js | /categories/uno/dos |

You may want to serve your page from a different path. This is possible by setting your own http path in the `routes` config. For example for `pages/post.js`:

```js
class Post extends React.Component {
  static async getInitialProps({ query }) {
    return {
      slug: query.slug
    };
  }
  render() {
    return <h1>Post page: {this.props.slug}</h1>;
  }
}

export default Post;
```

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    routes:
      - src: post
        path: posts/{slug}
        request:
          parameters:
            paths:
              slug: true
```

## Custom error page

404 or 500 errors are handled both client and server side by a default component `error.js`, same as documented [here](https://github.com/zeit/next.js/#custom-error-handling).

Simply add `pages/_error.js`:

```js
class Error extends React.Component {
  static getInitialProps({ res, err }) {
    const statusCode = res ? res.statusCode : err ? err.statusCode : null;
    return { statusCode };
  }

  render() {
    return (
      <p>
        {this.props.statusCode
          ? `An error ${this.props.statusCode} occurred on server (╯°□°)╯︵ ┻━┻`
          : "An error occurred on client"}
      </p>
    );
  }
}

export default Error;
```

## Custom lambda handler

If you need to customize the lambda handler you can do so by providing a path to your own handler in the `customHandler` field. Note that it resolves the path to the custom handler relative to your `next.config.js`.

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    customHandler: ./handler.js
```

The custom handler needs to look something like this:

```js
const compat = require("next-aws-lambda");

module.exports = page => {
  const handler = (event, context, callback) => {
    // do any stuff you like

    // this makes sure the next page renders
    compat(page)(event, context, callback);

    // do any other stuff you like
  };
  return handler;
};
```

## All plugin configuration options

| Plugin config key | Type               | Default Value | Description                                                                                                                                                                                                                   |
| ----------------- | ------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nextConfigDir     | `string`           | ./            | Path to parent directory of `next.config.js`.                                                                                                                                                                                 |
| assetsBucketName  | `string`           | \<empty\>     | Creates an S3 bucket with the name provided. The bucket will be used for uploading next static assets.                                                                                                                        |
| cloudFront        | `bool` \| `object` | false         | Set to `true` to create a cloud front distribution in front of your nextjs application. Also can be set to an `object` if you need to override CloudFront configuration, see [serving static assets](#serving-static-assets). |
| routes            | `[]object`         | []            | Array of custom routes for the next pages.                                                                                                                                                                                    |
| customHandler     | `string`           | \<empty\>     | Path to your own lambda handler.                                                                                                                                                                                              |
| uploadBuildAssets | `bool`             | true          | In the unlikely event that you only want to upload `static` or `public` dirs, set this to `false`.                                                                                                                            |
| createAssetBucket | `bool`             | true          | Set to false if you want to manage next assets yourself.                                                                                                                                                                      |

## Caveats

Beware this plugin relies on CloudFormation which has a hard limit of 200 resources. If you have a large number of pages in your application it is very likely that you will hit this limit. Contributions are welcome to investigate how this could be worked around by using something like https://github.com/dougmoscrop/serverless-plugin-split-stacks.

## Examples

See the `examples/` directory.

## Contributing

Please see the [contributing](./CONTRIBUTING.md) guide.

## Contributors

### Code Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/danielcondemarin/serverless-nextjs-plugin/graphs/contributors"><img src="https://opencollective.com/serverless-nextjs-plugin/contributors.svg?width=890&button=false" /></a>

### Financial Contributors

Become a financial contributor and help us sustain our community. [[Contribute](https://opencollective.com/serverless-nextjs-plugin/contribute)]

#### Individuals

<a href="https://opencollective.com/serverless-nextjs-plugin"><img src="https://opencollective.com/serverless-nextjs-plugin/individuals.svg?width=890"></a>

#### Organizations

Support this project with your organization. Your logo will show up here with a link to your website. [[Contribute](https://opencollective.com/serverless-nextjs-plugin/contribute)]

<a href="https://opencollective.com/serverless-nextjs-plugin/organization/0/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/0/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/1/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/1/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/2/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/2/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/3/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/3/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/4/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/4/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/5/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/5/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/6/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/6/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/7/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/7/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/8/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/8/avatar.svg"></a>
<a href="https://opencollective.com/serverless-nextjs-plugin/organization/9/website"><img src="https://opencollective.com/serverless-nextjs-plugin/organization/9/avatar.svg"></a>
