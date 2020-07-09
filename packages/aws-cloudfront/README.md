# aws-cloudfront

This package was copied from https://github.com/serverless-components/aws-cloudfront because it wasn't being maintained anymore.
It is being used by the [nextjs serverless component](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/serverless-component) to provision the CloudFront distribution behind the scenes.

&nbsp;

Deploy an AWS CloudFront distribution for the provided origins using [Serverless Components](https://github.com/serverless/components).

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)

&nbsp;

### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

```console
$ mkdir cdn
$ cd cdn
```

the directory should look something like this:

```
|- serverless.yml
|- .env      # your AWS api keys

```

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

### 3. Configure

```yml
# serverless.yml

distribution:
  component: '@serverless/aws-cloudfront'
  inputs:
    region: us-east-1
    enabled: true # optional
    comment: 'My distribution' # optional
    defaults: # optional
      ttl: 15
      allowedHttpMethods: ['HEAD', 'GET']
      forward: # optional
        # array of header names, 'none' or 'all'
        headers: ['Accept', 'Accept-Language']
        # array of cookie names, 'none' or 'all'
        cookies: ['my-cookie]
        queryString: true
        queryStringCacheKeys: ['queryKey']
      viewerProtocolPolicy: 'https-only' # optional
      smoothStreaming: true # optional
      compress: true # optional
      fieldLevelEncryptionId: '123' # optional
      lambda@edge: # added to cloudfront default cache behavior
        viewer-request: arn:aws:lambda:us-east-1:123:function:myFunc:version
    origins:
      - https://my-bucket.s3.amazonaws.com
```

#### Custom cache behavior

Custom cache behaviors support the same config parameters as the default cache behavior (see the example above).

```yml
# serverless.yml

distribution:
  component: "@serverless/aws-cloudfront"
  inputs:
    origins:
      - url: https://my-assets.com
        pathPatterns:
          /static/images: # route any /static/images requests to https://my-assets.com
            ttl: 10
            allowedHttpMethods: ["GET", "HEAD"] # optional
            forward: # optional
              headers: "all"
              cookies: ["auth-token"]
              queryString: true
            compress: false # optional
            # ...
```

#### Lambda@Edge

```yml
# serverless.yml

distribution:
  component: "@serverless/aws-cloudfront"
  inputs:
    origins:
      - url: https://sampleorigin.com
        pathPatterns:
          /sample/path:
            ttl: 10
            lambda@edge:
              viewer-request: arn:aws:lambda:us-east-1:123:function:myFunc:version # lambda ARN including version
```

#### Private S3 Content

To restrict access to content that you serve from S3 you can mark as `private` your S3 origins:

```yml
# serverless.yml

distribution:
  component: "@serverless/aws-cloudfront"
  inputs:
    origins:
      - url: https://my-private-bucket.s3.amazonaws.com
        private: true
```

A bucket policy will be added that grants CloudFront with access to the bucket objects. Note that it doesn't remove any existing permissions on the bucket. If users currently have permission to access the files in your bucket using Amazon S3 URLs you will need to manually remove those.

This is documented in more detail here: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

### 4. Deploy

```console
$ serverless
```

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
