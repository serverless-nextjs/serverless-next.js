# @sls-next/lambda
> Library to build and deploy Next.js apps for AWS Lambda + API Gateway

This library uses the handlers provided by `@sls-next/core` and wraps them with a Lambda/API Gateway-compatible layer so that Next.js apps can be served through API Gateway.

## Architecture

Once built and packaged, the app consists of the following components:

* Default handler: handles all requests, including pages, APIs, and regeneration requests.
* Image handler: handles images regeneration requests.
* Static assets: all static assets used by your app.

## Infrastructure

You will need the following infrastructure to deploy your app:

* AWS Lambda
* AWS API Gateway
* AWS S3 Bucket
* AWS SQS Queue (if you are using ISR)

## Deployment

(WIP) We will provide a simple lightweight CDK deployer which you can extend.

## Limitations

* Lambda limitations apply: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html.
* The image handler only serves image optimization requests, it cannot redirect, rewrite or add headers so far.
* Because the default and image handlers are separate, you cannot rewrite from default routes -> image routes.
* 
## Misc.

Special thanks for Jan Varho for the initial prototype which this code is based on.
