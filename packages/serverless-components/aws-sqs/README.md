# aws-sqs

Deploy SQS queues to AWS in seconds with [Serverless Components](https://github.com/serverless/components).

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

### 3. Configure

```yml
# serverless.yml

myQueue:
  component: "@serverless/aws-sqs"
```

### 4. Deploy

```console
$ serverless
```

### Credits

This package was originally implemented by [DaySmart](https://github.com/DaySmart/aws-sqs).
I decided to fork it and bring it into this monorepo because it wasn't being maintained anymore
