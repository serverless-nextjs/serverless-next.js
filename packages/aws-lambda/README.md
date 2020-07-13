# aws-lambda

Deploy Lambda functions to AWS in seconds with [Serverless Components](https://github.com/serverless/components). Utilizes layers for dependency management and S3 accelerated uploads for maximum upload speeds.

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
$ mkdir my-function && cd my-function
```

the directory should look something like this:

```
|- code
  |- handler.js
  |- package.json # optional
|- serverless.yml
|- .env           # your AWS api keys
```

```
# .env
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

```js
// handler.js
module.exports.hello = async (event, context, cb) => {
  return { hello: "world" };
};
```

### 3. Configure

```yml
# serverless.yml

myFunction:
  component: "@serverless/aws-lambda"
  inputs:
    name: my-function
    description: My Serverless Function
    memory: 128
    timeout: 20
    code: ./code
    handler: handler.hello
    runtime: nodejs8.10
    env:
      TABLE_NAME: my-table
    region: us-east-1

    # if you'd like to include any shims
    shims:
      - ../shims/shim.js

    # specifying an existing deployment bucket would optimise deployment speed
    # by using accelerated multipart uploads and dependency management with layers
    bucket: my-deployment-bucket
```

### 4. Deploy

```console
$ serverless
```

For a real world example of how this component could be used, [take a look at how the socket component is using it](https://github.com/serverless-components/socket).

&nbsp;

### Credits

This package was originally implemented by the [serverless framework team](https://github.com/serverless-components/domain).
I decided to fork it and bring it into this monorepo because it wasn't being maintained anymore
