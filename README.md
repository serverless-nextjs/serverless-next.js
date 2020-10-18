# Serverless Next.js Component

![logo](./logo.gif)

[![serverless](http://public.serverless.com/badges/v3.svg)](https://www.serverless.com)
[![GitHub contributors](https://img.shields.io/github/contributors/serverless-nextjs/serverless-next.js)](https://github.com/serverless-nextjs/serverless-next.js/graphs/contributors)
[![Financial Contributors on Open Collective](https://opencollective.com/serverless-nextjs-plugin/all/badge.svg?label=backers)](https://opencollective.com/serverless-nextjs-plugin)
[![npm version](https://badge.fury.io/js/%40sls-next%2Fserverless-component.svg)](https://badge.fury.io/js/%40sls-next%2Fserverless-component)
![Build Status](https://github.com/serverless-nextjs/serverless-next.js/workflows/CI/badge.svg)
![End-to-end Tests](https://github.com/serverless-nextjs/serverless-next.js/workflows/End-to-end%20Tests/badge.svg)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/manual/danielcondemarin/serverless-nextjs/dashboard?utm_source=github.com&utm_medium=referral&utm_content=serverless-nextjs/serverless-next.js&utm_campaign=Badge_Grade)
[![codecov](https://codecov.io/gh/serverless-nextjs/serverless-next.js/branch/master/graph/badge.svg)](https://codecov.io/gh/serverless-nextjs/serverless-next.js)
![Tested Next.js versions](https://img.shields.io/badge/tested%20next.js%20versions-9.5.5-blue)
![Platforms](https://img.shields.io/badge/platforms-aws-blue)

A zero configuration Next.js 9.0 [serverless component](https://github.com/serverless-components/) for AWS Lambda@Edge aiming for full feature parity.

Please review [features](https://github.com/serverless-nextjs/serverless-next.js#features) for a list of currently supported features.

## Contents

- [Motivation](#motivation)
- [Design principles](#design-principles)
- [Features](#features)
- [Getting started](#getting-started)
- [Lambda@Edge configuration](#lambda-at-edge-configuration)
- [Custom domain name](#custom-domain-name)
- [Custom CloudFront configuration](#custom-cloudfront-configuration)
- [Static pages caching](#static-pages-caching)
- [Public directory caching](#public-directory-caching)
- [AWS Permissions](#aws-permissions)
- [Architecture](#architecture)
- [Inputs](#inputs)
- [FAQ](#faq)

> :warning: This README may reference new or changed functionality that is not yet published to npm. Please go to [Releases](https://github.com/serverless-nextjs/serverless-next.js/releases), find the correct `@sls-next/serverless-component` version you are using, and open the README for that release for more accurate information.

### Motivation

Since Next.js 8.0, [serverless mode](https://nextjs.org/blog/next-8#serverless-nextjs) was introduced which provides a new low level API which projects like this can use to deploy onto different cloud providers. This project is a better version of the [serverless plugin](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/deprecated/serverless-plugin) which focuses on addressing core issues like [next 9 support](https://github.com/serverless-nextjs/serverless-next.js/issues/101), [better development experience](https://github.com/serverless-nextjs/serverless-next.js/issues/59), [the 200 CloudFormation resource limit](https://github.com/serverless-nextjs/serverless-next.js/issues/17) and [performance](https://github.com/serverless-nextjs/serverless-next.js/issues/13).

### Design principles

1. Zero configuration by default

There is no configuration needed. You can extend defaults based on your application needs.

2. Feature parity with Next.js

Users of this component should be able to use Next.js development tooling, aka `next dev`. It is the component's job to deploy your application ensuring parity with all of next's features we know and love. Below you can find a list of the features that are currently supported.

3. Fast deployments / no CloudFormation resource limits.

With a simplified architecture and no use of CloudFormation, there are no limits to how many pages you can have in your application, plus deployment times are very fast! with the exception of CloudFront propagation times of course.

### Features

The following shows all supported features or planned features. If the checkbox is ticked, it means that the feature is supported. Otherwise, it is likely not supported yet or currently in planning or implementation stage. Please refer to an item's description for specific details.

Is there a feature that you want but is not yet supported? Please open a [new issue](https://github.com/serverless-nextjs/serverless-next.js/issues/new?assignees=&labels=&template=feature_request.md&title=) to let us know!

- [x] [Server side rendered pages at the Edge](https://github.com/zeit/next.js#fetching-data-and-component-lifecycle).
      Pages that need server side compute to render are hosted on Lambda@Edge. The component takes care of all the routing for you so there is no configuration needed. Because rendering happens at the CloudFront edge locations latency is very low!
- [x] [API Routes](https://nextjs.org/docs#api-routes).
      Similarly to the server side rendered pages, API requests are also served from the CloudFront edge locations using Lambda@Edge.
- [x] [Dynamic pages / route segments](https://github.com/zeit/next.js/#dynamic-routing).
- [x] [Catch all routes](https://nextjs.org/docs/routing/dynamic-routes).
- [x] [Automatic prerendering](https://github.com/zeit/next.js/#automatic-prerendering).
      Statically optimised pages compiled by next are served from CloudFront edge locations with low latency and cost.
- [x] [Client assets](https://github.com/zeit/next.js/#cdn-support-with-asset-prefix).
      Next.js build assets `/_next/*` served from CloudFront.
- [x] [User static / public folders](https://github.com/zeit/next.js#static-file-serving-eg-images).
      Any of your assets in the static or public folders are uploaded to S3 and served from CloudFront automatically.
- [x] [Opt-in to static generation (SSG)](https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation) via `getStaticProps`.
- [x] [Opt-in to server-side rendering (SSR)](https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering) via `getServerSideProps`.
- [x] [Statically generate a set of routes from dynamic sources](https://nextjs.org/docs/basic-features/data-fetching#getstaticpaths-static-generation) via `getStaticPaths` (Note: known conflict with public files if you use this with a root dynamic route and `fallback: false` is not supported in 1.17. Please try the latest 1.18 alpha in case of any issues).
- [x] [Base path](https://nextjs.org/docs/api-reference/next.config.js/basepath)
- [x] [Preview mode](https://nextjs.org/docs/advanced-features/preview-mode)
- [ ] [Optional catch all routes](https://nextjs.org/docs/routing/dynamic-routes#optional-catch-all-routes)
- [x] [Redirects](https://nextjs.org/docs/api-reference/next.config.js/redirects). In latest alpha release (caveat: every route should be able to redirect except `_next/static/*` and `static/*`, since those cache behaviors do not have Lambda handlers attached to them). See [RFC](https://github.com/serverless-nextjs/serverless-next.js/issues/587) for updates.
- [x] [Rewrites](https://nextjs.org/docs/api-reference/next.config.js/rewrites). In latest alpha release (caveats: every route should be able to rewrite except `_next/static/*` and `static/*`, since those cache behaviors do not have Lambda handlers attached to them. [External URL rewrites](https://nextjs.org/docs/api-reference/next.config.js/rewrites#rewriting-to-an-external-url) are not yet implemented). See [RFC](https://github.com/serverless-nextjs/serverless-next.js/issues/587) for updates.
- [x] [Custom Headers](https://nextjs.org/docs/api-reference/next.config.js/headers). In latest alpha release (caveats: every route should be able to have custom headers except `_next/static/*` and `static/*`, since those cache behaviors do not have Lambda handlers attached to them. You also need to specify the S3 key as the source when redirecting any path mapped to an S3 file (see [PR](https://github.com/serverless-nextjs/serverless-next.js/pull/662) for more details). See [RFC](https://github.com/serverless-nextjs/serverless-next.js/issues/587) for updates.

### Getting started

Add your next application to the serverless.yml:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}" # it is recommended you pin the latest stable version of serverless-next.js
```

Set your AWS credentials as environment variables:

```bash
AWS_ACCESS_KEY_ID=accesskey
AWS_SECRET_ACCESS_KEY=sshhh
```

And simply deploy:

```bash
$ serverless
```

:no_entry_sign: **Don't attempt to deploy by running `serverless deploy`, use only `serverless`**

:no_entry_sign: **Do not add `@sls-next/serverless-component` to your package.json file, it is not used and only the version in `serverless.yml` file is used. If you do not specify the version, it will use the `latest` tag, which refers to the latest stable version [here](https://www.npmjs.com/package/@sls-next/serverless-component) (i.e not alpha versions).**

### Custom domain name

In most cases you wouldn't want to use CloudFront's distribution domain to access your application. Instead, you can specify a custom domain name.

You can use any domain name but you must be using AWS Route53 for your DNS hosting. To migrate DNS records from an existing domain follow the instructions
[here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html). The requirements to use a custom domain name:

- Route53 must include a _hosted zone_ for your domain (e.g. `mydomain.com`) with a set of nameservers.
- You must update the nameservers listed with your domain name registrar (e.g. namecheap, godaddy, etc.) with those provided for your new _hosted zone_.

The serverless Next.js component will automatically generate an SSL certificate and create a new record to point to your CloudFront distribution.

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    domain: "example.com" # sub-domain defaults to www
```

You can also configure a `subdomain`:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    domain: ["sub", "example.com"] # [ sub-domain, domain ]
```

### Custom CloudFront configuration

To specify your own CloudFront inputs, just add any [aws-cloudfront inputs](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-components/aws-cloudfront#3-configure) under `cloudfront`:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    cloudfront:
      # if you want to use an existing cloudfront distribution, provide it here
      distributionId: XYZEXAMPLE #optional
      # this is the default cache behaviour of the cloudfront distribution
      # the origin-request edge lambda associated to this cache behaviour does the pages server side rendering
      defaults:
        forward:
          headers:
            [
              CloudFront-Is-Desktop-Viewer,
              CloudFront-Is-Mobile-Viewer,
              CloudFront-Is-Tablet-Viewer,
            ]
      # this is the cache behaviour for next.js api pages
      api:
        minTTL: 10
        maxTTL: 10
        defaultTTL: 10
      # you can set other cache behaviours like "defaults" above that can handle server side rendering
      # but more specific for a subset of your next.js pages
      /blog/*:
        minTTL: 1000
        maxTTL: 1000
        defaultTTL: 1000
        forward:
          cookies: "all"
          queryString: false
      /about:
        minTTL: 3000
        maxTTL: 3000
        defaultTTL: 3000
      # you can add custom origins to the cloudfront distribution
      origins:
        - url: /static
          pathPatterns:
            /wp-content/*:
              minTTL: 10
              maxTTL: 10
              defaultTTL: 10
        - url: https://old-static.com
          pathPatterns:
            /old-static/*:
              minTTL: 10
              maxTTL: 10
              defaultTTL: 10
        - url: http://old-api.com
          protocolPolicy: http-only
          pathPatterns:
            /old-api/*:
              minTTL: 10
              maxTTL: 10
              defaultTTL: 10
      aliases: ["foo.example.com", "bar.example.com"]
      priceClass: "PriceClass_100"
      # You can add custom error responses
      errorPages:
        - code: 503
          path: "/503.html"
          minTTL: 5 # optional, minimum ttl the error is cached (default 10)
          responseCode: 500 # optional, alters the response code
```

This is particularly useful for caching any of your Next.js pages at CloudFront's edge locations. See [this](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-components/nextjs-component/examples/app-with-custom-caching-config) for an example application with custom cache configuration.
You can also [update an existing cloudfront distribution](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-components/aws-cloudfront#updating-an-existing-cloudfront-distribution) using custom cloudfront inputs.

### Static pages caching

Statically rendered pages (i.e. HTML pages that are uploaded to S3) have the following Cache-Control set:

```
cache-control: public, max-age=0, s-maxage=2678400, must-revalidate
```

`s-maxage` allows Cloudfront to cache the pages at the edge locations for 31 days.
`max-age=0` in combination with `must-revalidate` ensure browsers never cache the static pages. This allows Cloudfront to be in full control of caching TTLs. On every deployment an invalidation`/*` is created to ensure users get fresh content.

### Public directory caching

By default, common image formats(`gif|jpe?g|jp2|tiff|png|webp|bmp|svg|ico`) under `/public` or `/static` folders
have a one-year `Cache-Control` policy applied(`public, max-age=31536000, must-revalidate`).
You may customize either the `Cache-Control` header `value` and the regex of which files to `test`, with `publicDirectoryCache`:

```yaml
myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    publicDirectoryCache:
      value: public, max-age=604800
      test: /\.(gif|jpe?g|png|txt|xml)$/i
```

`value` must be a valid `Cache-Control` policy and `test` must be a valid `regex` of the types of files you wish to test.
If you don't want browsers to cache assets from the public directory, you can disable this:

```yaml
myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    publicDirectoryCache: false
```

### AWS Permissions

By default the Lambda@Edge functions run using AWSLambdaBasicExecutionRole which only allows uploading logs to CloudWatch. If you need permissions beyond this, like for example access to DynamoDB or any other AWS resource you will need your own custom policy arn:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    policy: "arn:aws:iam::123456789012:policy/MyCustomPolicy"
```

Make sure you add CloudWatch log permissions to your custom policy.

The exhaustive list of AWS actions required for a deployment:

```
  "acm:DescribeCertificate", // only for custom domains
  "acm:ListCertificates",    // only for custom domains
  "acm:RequestCertificate",  // only for custom domains
  "cloudfront:CreateCloudFrontOriginAccessIdentity",
  "cloudfront:CreateDistribution",
  "cloudfront:CreateInvalidation",
  "cloudfront:GetDistribution",
  "cloudfront:GetDistributionConfig",
  "cloudfront:ListCloudFrontOriginAccessIdentities",
  "cloudfront:ListDistributions",
  "cloudfront:ListDistributionsByLambdaFunction",
  "cloudfront:ListDistributionsByWebACLId",
  "cloudfront:ListFieldLevelEncryptionConfigs",
  "cloudfront:ListFieldLevelEncryptionProfiles",
  "cloudfront:ListInvalidations",
  "cloudfront:ListPublicKeys",
  "cloudfront:ListStreamingDistributions",
  "cloudfront:UpdateDistribution",
  "iam:AttachRolePolicy",
  "iam:CreateRole",
  "iam:CreateServiceLinkedRole",
  "iam:GetRole",
  "iam:PassRole",
  "lambda:CreateFunction",
  "lambda:EnableReplication",
  "lambda:DeleteFunction",            // only for custom domains
  "lambda:GetFunction",
  "lambda:GetFunctionConfiguration",
  "lambda:PublishVersion",
  "lambda:UpdateFunctionCode",
  "lambda:UpdateFunctionConfiguration",
  "route53:ChangeResourceRecordSets", // only for custom domains
  "route53:ListHostedZonesByName",
  "route53:ListResourceRecordSets",   // only for custom domains
  "s3:CreateBucket",
  "s3:GetAccelerateConfiguration",
  "s3:GetObject",                     // only if persisting state to S3 for CI/CD
  "s3:HeadBucket",
  "s3:ListBucket",
  "s3:PutAccelerateConfiguration",
  "s3:PutBucketPolicy",
  "s3:PutObject"
```

### Lambda At Edge Configuration

Both **default** and **api** edge lambdas will be assigned 512mb of memory by default. This value can be altered by assigning a number to the `memory` input

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    memory: 1024
```

Values for **default** and **api** lambdas can be separately defined by assigning `memory` to an object like so:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    memory:
      defaultLambda: 1024
      apiLambda: 2048
```

The same pattern can be followed for specifying the Node.js runtime (nodejs12.x by default):

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    runtime:
      defaultLambda: "nodejs10.x"
      apiLambda: "nodejs10.x"
```

Similarly, the timeout by default is 10 seconds. To customise you can:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    timeout:
      defaultLambda: 20
      apiLambda: 15
```

Note the maximum timeout allowed for Lambda@Edge is 30 seconds. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html

You can also set a custom name for **default** and **api** lambdas - if not the default is set by the [aws-lambda serverless component](https://github.com/serverless-components/aws-lambda) to the resource id:

```yml
# serverless.yml

myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    name:
      defaultLambda: fooDefaultLambda
      apiLambda: fooApiLambda
```

### Architecture

![architecture](./arch_no_grid.png)

Four Cache Behaviours are created in CloudFront.

The first two `_next/*` and `static/*` forward the requests to S3.

The third is associated to a lambda function which is responsible for handling three types of requests.

1. Server side rendered page. Any page that defines `getInitialProps` method will be rendered at this level and the response is returned immediately to the user.

2. Statically optimised page. Requests to pages that were pre-compiled by next to HTML are forwarded to S3.

3. Public resources. Requests to root level resources like `/robots.txt`, `/favicon.ico`, `/manifest.json`, etc. These are forwarded to S3.

The reason why 2. and 3. have to go through Lambda@Edge first is because the routes don't conform to a pattern like `_next/*` or `static/*`. Also, one cache behaviour per route is a bad idea because CloudFront only allows [25 per distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-web-distributions).

The fourth cache behaviour handles next API requests `api/*`.

### Inputs

| Name                     | Type              | Default Value                                                                                                              | Description                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain                   | `Array`           | `null`                                                                                                                     | For example `['admin', 'portal.com']`                                                                                                                                                                                                                                                                                                                                            |
| domainRedirects          | `object`          | `{}`                                                                                                                       | Adds domain-level redirects at the edge using a 308 redirect. Specify an object of domain name -> redirect destination with protocol. For example, `www.example.com: https://example.com`. See [here](https://github.com/serverless-nextjs/serverless-next.js#i-was-expecting-for-automatic-subdomain-redirection-when-using-the-domaintype-wwwapex-input) for more information. |
| bucketName               | `string`          | `null`                                                                                                                     | Custom bucket name where static assets are stored. By default is autogenerated.                                                                                                                                                                                                                                                                                                  |
| bucketRegion             | `string`          | `null`                                                                                                                     | Region where you want to host your s3 bucket. Make sure this is geographically closer to the majority of your end users to reduce latency when CloudFront proxies a request to S3.                                                                                                                                                                                               |
| nextConfigDir            | `string`          | `./`                                                                                                                       | Directory where your application `next.config.js` file is. This input is useful when the `serverless.yml` is not in the same directory as the next app. <br>**Note:** `nextConfigDir` should be set if `next.config.js` `distDir` is used                                                                                                                                        |
| nextStaticDir            | `string`          | `./`                                                                                                                       | If your `static` or `public` directory is not a direct child of `nextConfigDir` this is needed                                                                                                                                                                                                                                                                                   |
| description              | `string`          | `*lambda-type*@Edge for Next CloudFront distribution`                                                                      | The description that will be used for both lambdas. Note that "(API)" will be appended to the API lambda description.                                                                                                                                                                                                                                                            |
| policy                   | `string\|object`  | `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`                                                         | The arn or inline policy that will be assigned to both lambdas.                                                                                                                                                                                                                                                                                                                  |
| runtime                  | `string\|object`  | `nodejs12.x`                                                                                                               | When assigned a value, both the default and api lambdas will be assigned the runtime defined in the value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                          |  |
| memory                   | `number\|object`  | `512`                                                                                                                      | When assigned a number, both the default and api lambdas will be assigned memory of that value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                                     |  |
| timeout                  | `number\|object`  | `10`                                                                                                                       | Same as above                                                                                                                                                                                                                                                                                                                                                                    |
| name                     | `string\|object`  | /                                                                                                                          | When assigned a string, both the default and api lambdas will assigned name of that value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                                          |
| build                    | `boolean\|object` | `true`                                                                                                                     | When true builds and deploys app, when false assume the app has been built and uses the `.next` `.serverless_nextjs` directories in `nextConfigDir` to deploy. If an object is passed `build` allows for overriding what script gets called and with what arguments.                                                                                                             |
| build.cmd                | `string`          | `node_modules/.bin/next`                                                                                                   | Build command                                                                                                                                                                                                                                                                                                                                                                    |
| build.args               | `Array\|string`   | `['build']`                                                                                                                | Arguments to pass to the build                                                                                                                                                                                                                                                                                                                                                   |
| build.cwd                | `string`          | `./`                                                                                                                       | Override the current working directory                                                                                                                                                                                                                                                                                                                                           |
| build.enabled            | `boolean`         | `true`                                                                                                                     | Same as passing `build:false` but from within the config                                                                                                                                                                                                                                                                                                                         |
| build.env                | `object`          | `{}`                                                                                                                       | Add additional environment variables to the script                                                                                                                                                                                                                                                                                                                               |
| cloudfront               | `object`          | `{}`                                                                                                                       | Inputs to be passed to [aws-cloudfront](https://github.com/serverless-components/aws-cloudfront)                                                                                                                                                                                                                                                                                 |
| certificateArn           | `string`          | `` | Specific certificate ARN to use for CloudFront distribution. Helpful if you have a wildcard SSL cert you wish to use. |
| domainType               | `string`          | `"both"`                                                                                                                   | Can be one of: `"apex"` - apex domain only, don't create a www subdomain. `"www"` - www domain only, don't create an apex subdomain.`"both"` - create both www and apex domains when either one is provided.                                                                                                                                                                     |
| publicDirectoryCache     | `boolean\|object` | `true`                                                                                                                     | Customize the `public`/`static` folder asset caching policy. Assigning an object with `value` and/or `test` lets you customize the caching policy and the types of files being cached. Assigning false disables caching                                                                                                                                                          |
| useServerlessTraceTarget | `boolean`         | `false`                                                                                                                    | Use the experimental-serverless-trace target to build your next app. This is the same build target that Vercel Now uses. See this [RFC](https://github.com/vercel/next.js/pull/8246) for details.                                                                                                                                                                                |
| logLambdaExecutionTimes  | `boolean`         | `false`                                                                                                                    | Logs to CloudWatch the default handler performance metrics.                                                                                                                                                                                                                                                                                                                      |
| minifyHandlers           | `boolean`         | `false`                                                                                                                    | Use minified handlers to reduce code size.                                                                                                                                                                                                                                                                                                                                       |
| deploy                   | `boolean`         | `true`                                                                                                                     | Whether to deploy resources to AWS. Useful if you just need the Lambdas and assets but want to deploy them yourself (available in latest alpha).                                                                                                                                                                                                                                 |

Custom inputs can be configured like this:

```yaml
myNextApp:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    bucketName: my-bucket
```

### FAQ

#### My component doesn't deploy

Make sure your `serverless.yml` uses the `serverless-components` format. [serverless components](https://serverless.com/blog/what-are-serverless-components-how-use/) differ from the original serverless framework, even though they are both accessible via the same CLI.

:white_check_mark: **Do**

```yml
# serverless.yml
myNextApp:
  component: "@sls-next/serverless-component@{version_here}"

myTable:
  component: serverless/aws-dynamodb
  inputs:
    name: Customers
# other components
```

:no_entry_sign: **Don't**

```yml
# serverless.yml
provider:
  name: aws
  runtime: nodejs10.x
  region: eu-west-1

myNextApp:
  component: "@sls-next/serverless-component@{version_here}"

Resources: ...
```

Note how the correct yaml doesn't declare a `provider`, `Resources`, etc.

For deploying, don't run `serverless deploy`. Simply run `serverless` and that deploys your components declared in the `serverless.yml` file.

For more information about serverless components go [here](https://serverless.com/blog/what-are-serverless-components-how-use/).

#### The Lambda@Edge code size is too large

The API handler and default handler packages are deployed separately, but each has a limit of 50 MB zipped or 250 MB uncompressed per AWS - see [here](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) and [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html). By design, there is currently only one Lambda@Edge for all page routes and one Lambda@Edge for all API routes. This could lead to code size issues especially if you have many API routes, SSR pages, etc.

If you are encountering code size issues, please try the following:

- Optimize your code size: reduce # dependencies in your SSR pages and API routes, have fewer SSR pages (i.e don't use `getInitialProps()` or `getServerSideProps()`).

- Minify the handler code itself by using the `minifyHandlers` input. This will reduce handler size from ~500 kB to ~200 kB.

- Minify/minimize your server-side code using Terser by adding the following Webpack configuration to your `next.config.js`. It uses `NEXT_MINIMIZE` environment variable to tell it to minimize the SSR code. Note that this will increase build times, and minify the code so it could be harder to debug CloudWatch errors.

First, add `terser-webpack-plugin` to your dependencies. Then update `next.config.js`:

```js
const TerserPlugin = require("terser-webpack-plugin");
```

```js
webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
  if (isServer && !dev && process.env.NEXT_MINIMIZE === "true") {
    config.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          cache: true,
          terserOptions: {
            output: { comments: false },
            mangle: true,
            compress: true
          },
          extractComments: false
        })
      ]
    };
  }

  return config;
};
```

Note that if you do not use any API routes, all JS files used only for prerendering static pages are automatically removed from the bundle. However, if you use API routes, we do not remove them as they may be used for preview mode. There's no official/non-hacky way to identify and remove these JS files not used in preview mode even when API routes are used. But we can add a new input to manually exclude them, if needed.

- Use the `useServerlessTraceTarget` option in `serverless.yml`. This will cause Next.js to not bundle dependencies into each page (instead creating lightweight pages) and then `serverless-next.js` will reference a single set of dependencies in `node_modules`.

#### Serverless deployment takes a long time and times out with a message like "TimeoutError: Connection timed out after 120000ms"

This is likely either because of a Lambda@Edge code size issue (see above for potential solutions. Related [GitHub Issue](https://github.com/serverless-nextjs/serverless-next.js/issues/611)) or if you have a slow network upload speed and/or are trying to deploy a large Lambda package.

In the second case, the `aws-sdk` npm package used has a default timeout of 120 seconds. Right now this is not configurable, but we may support longer timeouts in the near future (similar to https://github.com/serverless/serverless/pull/937, which only applies to Serverless Framework, not Serverless Components).

#### When accessing the Host header in my SSR pages or APIs, I get an S3 domain instead of the CloudFront distribution or my domain name

By default, CloudFront sets the `Host` header to the S3 origin host name. You need to forward the `Host` header to the origin. See the example below for forwarding it for your `api/*` cache behavior:

```yml
myNextApplication:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    cloudfront:
      api/*:
        forward:
          headers: [Host]
```

#### Should I use the [serverless-plugin](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/deprecated/serverless-plugin) or this component?

Users are encouraged to use this component instead of the `serverless-plugin`. This component was built and designed using lessons learned from the serverless plugin.

#### How do I interact with other AWS Services within my app?

See `examples/dynamodb-crud` for an example Todo application that interacts with DynamoDB. You can find a full list of examples [here](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-component/examples)

#### [CI/CD] Multi-stage deployments / A new CloudFront distribution is created on every CI build. I wasn't expecting that

1. You need to commit your application state in source control. That is the files under the `.serverless` directory. Although this is not recommended as it doesn't work well for multiple stages.
2. Alternatively you could use S3 to store the `.serverless` files, see an example [here](https://gist.github.com/hadynz/b4e190e0ce10e5811cb462920a9c678f), [here](https://gist.github.com/dphang/7395ee09f6182f6b34f224660bed8e8c) (uses multiple `serverless.yml` files), or [here](https://github.com/serverless-nextjs/serverless-next.js/issues/328#issuecomment-655466654) (GitHub Actions-based, uses multiple `serverless.yml` files).
3. You can also use the `distributionId` CloudFront input to specify an existing CloudFront distribution to deploy to.

In the future, we will look to improve this by integrating proper stage management into the component itself.

#### My lambda is deployed to `us-east-1`. How can I deploy it to another region?

Serverless Next.js is _regionless_. By design, `serverless-next.js` applications will be deployed across the globe to every CloudFront edge location. The lambda might look like is only deployed to `us-east-1` but behind the scenes, it is replicated to every other region.

#### I require passing additional information into my build

See the sample below for an advanced `build` setup that includes passing additional arguments and environment variables to the build.

```yml
# serverless.yml
myDatabase:
  component: MY_DATABASE_COMPONENT
myNextApp:
  component: "@sls-next/serverless-component@{version_here}"
  inputs:
    build:
      args: ["build", "custom/path/to/pages"]
      env:
        DATABASE_URL: ${myDatabase.databaseUrl}
```

#### I was expecting for automatic subdomain redirection when using the domainType: www/apex input

You can use the new `domainRedirects` input, along with forwarding `Host` header and `domainType: both`, to redirect requests to the correct domain. See example configuration below that redirects `www.example.com` requests to `https://example.com`.

```yml
next-app:
  component: "../../serverless-components/nextjs-component"
  inputs:
    cloudfront:
      defaults:
        forward:
          headers: [Host]
    domain: ["example.com"]
    domainType: "both"
    domainRedirects:
      www.example.com: https://example.com
```

All of this happens within the Lambda@Edge origin request handlers. Please note that this will not allow you to redirect requests at `_next/static/*` or `/static/*`, since those cache behaviors do not have a Lambda@Edge handler attached to them.

Otherwise, you can also use the manual workaround using an S3 bucket outlined [here](https://simonecarletti.com/blog/2016/08/redirect-domain-https-amazon-cloudfront/#configuring-the-amazon-s3-static-site-with-redirect).
In summary, you will have to create a new S3 bucket and set it up with static website hosting to redirect requests to your supported subdomain type (ex. "www.example.com" or "example.com"). To be able to support HTTPS redirects, you'll need to set up a CloudFront distribution with the S3 redirect bucket as the origin. Finally, you'll need to create an "A" record in Route 53 with your newly created CloudFront distribution as the alias target.

## Contributing

Please see the [contributing](./CONTRIBUTING.md) guide.

## Contributors

### Code Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/serverless-nextjs/serverless-next.js/graphs/contributors">
<img src="https://contributors-img.web.app/image?repo=serverless-nextjs/serverless-next.js" />
</a>

Made with [contributors-img](https://contributors-img.web.app).

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
