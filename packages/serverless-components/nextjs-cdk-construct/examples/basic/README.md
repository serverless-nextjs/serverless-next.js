# Basic example of using Next.js and AWS CDK

The application is an example of how to manage AWS resources for Next.js using AWS CDK.

## How to use

```bash
$ cd /PATH/TO/EXAMPLE/basic
$ npm install
$ npm run dev

# or

$ cd /PATH/TO/EXAMPLE/basic
$ yarn
$ yarn dev
```

## Deploy

We need to build the CDK stack before running the deployment command.

```bash
$ npm run build

# or

$ yarn build
```

Then, run the CDK command.
It will build the Next.js application automatically.
So you don't have to run the `next build` command.

```bash
$ npm run cdk deploy

# or

$ yarn cdk deploy
```

### Commands

```bash
# compile typescript to js
$ npm run build

# watch for changes and compile
$ npm run cdk:watch

# perform the jest unit tests
$ npm run cdk:test

# deploy this stack to your default AWS account/region
$ cdk deploy

# compare deployed stack with current state
$ cdk diff

# emits the synthesized CloudFormation template
$ cdk synth
```
