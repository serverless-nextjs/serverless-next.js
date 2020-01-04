# Serverless Nextjs Component

![logo](./logo.gif)

A zero configuration Nextjs 9.0 [serverless component](https://github.com/serverless-components/) with full feature parity.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-next.js.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-next.js)
[![Financial Contributors on Open Collective](https://opencollective.com/serverless-nextjs-plugin/all/badge.svg?label=financial+contributors)](https://opencollective.com/serverless-nextjs-plugin) [![npm version](https://badge.fury.io/js/serverless-next.js.svg)](https://badge.fury.io/js/serverless-next.js)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-next.js/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-next.js?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

## Contents

- [Motivation](#motivation)
- [Design principles](#design-principles)
- [Features](#features)
- [Getting started](#getting-started)
- [Lambda@Edge configuration](#lambda-at-edge-configuration)
- [Custom domain name](#custom-domain-name)
- [AWS Permissions](#aws-permissions)
- [Architecture](#architecture)
- [Inputs](#inputs)
- [FAQ](#faq)

### Motivation

Since Nextjs 8.0, [serverless mode](https://nextjs.org/blog/next-8#serverless-nextjs) was introduced which provides a new low level API which projects like this can use to deploy onto different cloud providers. This project is a better version of the [serverless plugin](https://github.com/danielcondemarin/serverless-next.js/tree/master/packages/serverless-nextjs-plugin) which focuses on addressing core issues like [next 9 support](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/101), [better development experience](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/59), [the 200 CloudFormation resource limit](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/17) and [performance](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/13).

### Design principles

1. Zero configuration by default

There is no configuration needed. You can extend defaults based on your application needs.

2. Feature parity with nextjs

Users of this component should be able to use nextjs development tooling, aka `next dev`. It is the component's job to deploy your application ensuring parity with all of next's features we know and love.

3. Fast deployments / no CloudFormation resource limits.

With a simplified architecture and no use of CloudFormation, there are no limits to how many pages you can have in your application, plus deployment times are very fast! with the exception of CloudFront propagation times of course.

### Features

- [x] [Server side rendered pages at the Edge](https://github.com/zeit/next.js#fetching-data-and-component-lifecycle).
      Pages that need server side compute to render are hosted on Lambda@Edge. The component takes care of all the routing for you so there is no configuration needed. Because rendering happens at the CloudFront edge locations latency is very low!
- [x] [API Routes](https://nextjs.org/docs#api-routes).
      Similarly to the server side rendered pages, API requests are also served from the CloudFront edge locations using Lambda@Edge.
- [x] [Dynamic pages / route segments](https://github.com/zeit/next.js/#dynamic-routing).
- [x] [Automatic prerendering](https://github.com/zeit/next.js/#automatic-prerendering).
      Statically optimised pages compiled by next are served from CloudFront edge locations with low latency and cost.
- [x] [Client assets](https://github.com/zeit/next.js/#cdn-support-with-asset-prefix).
      Nextjs build assets `/_next/*` served from CloudFront.
- [x] [User static / public folders](https://github.com/zeit/next.js#static-file-serving-eg-images).
      Any of your assets in the static or public folders are uploaded to S3 and served from CloudFront automatically.

### Getting started

Install the next.js component:

`npm install serverless-next.js --save-dev`

Add your next application to the serverless.yml:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
```

Set your aws credentials in a `.env` file:

```bash
AWS_ACCESS_KEY_ID=accesskey
AWS_SECRET_ACCESS_KEY=sshhh
```

Set next.js build target to `serverless`:

```js
// next.config.js

module.exports = {
  target: "serverless"
};
```

And simply deploy:

```bash
$ serverless
```

### Custom domain name

In most cases you wouldn't want to use CloudFront's distribution domain to access your application. Instead, you can specify a custom domain name.

Make sure you've purchased your `domain` within Route53:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: "example.com" # sub-domain defaults to www
```

You can also configure a `subdomain`:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: ["sub", "example.com"] # [ sub-domain, domain ]
```

### AWS Permissions

By default the Lambda@Edge functions run using AWSLambdaBasicExecutionRole which only allows uploading logs to CloudWatch. If you need permissions beyond this, like for example access to DynamoDB or any other AWS resource you will need your own custom policy arn:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    policy: "arn:aws:iam::123456789012:policy/MyCustomPolicy"
```

Make sure you add CloudWatch log permissions to your custom policy.

### Lambda At Edge Configuration

Both **default** and **api** edge lambdas will be assigned 512mb of memory by default. This value can be altered by assigning a number to the `memory` input

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    memory: 1024
```

Values for **default** and **api** lambdas can be separately defined by assigning `memory` to an object like so:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    memory:
      defaultLambda: 1024
      apiLambda: 2048
```

Similarly, the timeout by default is 10 seconds. To customise you can:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    timeout:
      defaultLambda: 20
      apiLambda: 15
```

Note the maximum timeout allowed for Lambda@Edge is 30 seconds. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html

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

| Name          | Type              | Default Value            | Description                                                                                                                                                                                                                                                          |
| ------------- | ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain        | `Array`           | `null`                   | For example `['admin', 'portal.com']`                                                                                                                                                                                                                                |
| bucketName    | `string`          | `null`                   | Custom bucket name where static assets are stored. By default is autogenerated.                                                                                                                                                                                      |
| nextConfigDir | `string`          | `./`                     | Directory where your application `next.config.js` file is. This input is useful when the `serverless.yml` is not in the same directory as the next app. <br>**Note:** `nextConfigDir` should be set if `next.config.js` `distDir` is used                            |
| nextStaticDir | `string`          | `./`                     | If your `static` or `public` directory is not a direct child of `nextConfigDir` this is needed                                                                                                                                                                       |
| memory        | `number\|object`  | `512`                    | When assigned a number, both the default and api lambdas will assigned memory of that value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                            |  |
| timeout       | `number\|object`  | `10`                     | Same as above                                                                                                                                                                                                                                                        |
| build         | `boolean\|object` | `true`                   | When true builds and deploys app, when false assume the app has been built and uses the `.next` `.serverless_nextjs` directories in `nextConfigDir` to deploy. If an object is passed `build` allows for overriding what script gets called and with what arguments. |
| build.cmd     | `string`          | `node_modules/.bin/next` | Build command                                                                                                                                                                                                                                                        |
| build.args    | `Array\|string`   | `['build']`              | Arguments to pass to the build                                                                                                                                                                                                                                       |
| build.cwd     | `string`          | `./`                     | Override the current working directory                                                                                                                                                                                                                               |
| build.enabled | `boolean`         | `true`                   | Same as passing `build:false` but from within the config                                                                                                                                                                                                             |
| build.env     | `object`          | `{}`                     | Add additional environment variables to the script                                                                                                                                                                                                                   |

Custom inputs can be configured like this:

```yaml
myNextApp:
  component: serverless-next.js
  inputs:
    bucketName: my-bucket
```

### FAQ

#### My component doesn't deploy

Make sure your `serverless.yml` uses the `serverless-components` format. [serverless components](https://serverless.com/blog/what-are-serverless-components-how-use/) differ from the original serverless framework, even though they are both accessible via the same CLI.

✅ **Do**

```yml
# serverless.yml
myNextApp:
  component: serverless-next.js

myTable:
  component: serverless/aws-dynamodb
  inputs:
    name: Customers
# other components
```

❌ **Don't**

```yml
# serverless.yml
provider:
  name: aws
  runtime: nodejs10.x
  region: eu-west-1

myNextApp:
  component: serverless-next.js

Resources: ...
```

Note how the correct yaml doesn't declare a `provider`, `Resources`, etc.

For deploying, don't run `serverless deploy`. Simply run `serverless` and that deploys your components declared in the `serverless.yml` file.

For more information about serverless components go [here](https://serverless.com/blog/what-are-serverless-components-how-use/).

#### Should I use the [serverless-nextjs-plugin](https://github.com/danielcondemarin/serverless-nextjs-plugin/tree/master/packages/serverless-nextjs-plugin) or this component?

Users are encouraged to use this component instead of the `serverless-nextjs-plugin`. This component was built and designed using lessons learned from the serverless plugin.

#### How do I interact with other AWS Services within my app?

See `examples/dynamodb-crud` for an example Todo application that interacts with DynamoDB.

#### [CI/CD] A new CloudFront distribution is created on every CI build. I wasn't expecting that

You need to commit your application state in source control. That is the files under the `.serverless` directory.
The serverless team is currently working on remote state storage so this won't be necessary in the future.

#### My lambda is deployed to `us-east-1`. How can I deploy it to another region?

Serverless next.js is _regionless_. By design, `serverless-next.js` applications will be deployed across the globe to every CloudFront edge location. The lambda might look like is only deployed to `us-east-1` but behind the scenes, it is replicated to every other region.

#### I require passing additional information into my build

See the sample below for an advanced `build` setup that includes passing additional arguments and environment variables to the build.

```yml
# serverless.yml
myDatabase:
  component: MY_DATABASE_COMPNENT
myNextApp:
  component: serverless-next.js
  build:
    args: ["build", "custom/path/to/pages"]
    env:
      DATABASE_URL: ${myDatabase.databaseUrl}
```

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
