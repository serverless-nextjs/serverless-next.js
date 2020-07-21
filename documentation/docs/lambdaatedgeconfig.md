---
id: lambdaatedgeconfig
title: Lambda At Edge Configuration
sidebar_label: Lambda At Edge Configuration
---

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

The same pattern can be followed for specifying the Node.js runtime (nodejs12.x by default):

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    runtime:
      defaultLambda: "nodejs10.x"
      apiLambda: "nodejs10.x"
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

You can also set a custom name for **default** and **api** lambdas - if not the default is set by the [aws-lambda serverless component](https://github.com/serverless-components/aws-lambda) to the resource id:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    name:
      defaultLambda: fooDefaultLambda
      apiLambda: fooApiLambda
```