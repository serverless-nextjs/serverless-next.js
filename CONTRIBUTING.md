## Contributing

### Getting started

1. First, [fork](https://help.github.com/en/articles/fork-a-repo) the repo to your own github account and clone it.
2. Install dependencies: `yarn`

### Running the tests

#### Unit tests

I recommend testing the specific package in the monorepo that you are working with. For example:

```bash
yarn test lambda-at-edge/
```

In watch mode:

```bash
yarn test --watch lambda-at-edge/
```

#### Integration tests

To run local integration tests, run the following command:

```bash
yarn integration
```

#### End-to-end tests

The end-to-end tests will automatically verify a real deployment to AWS using a test app. The test app may also be useful for you to manually verify your changes.

1. Ensure you have built all your changes by running `yarn` in the root directory of `serverless-next.js` repository.
2. Change directory to the test [Next.js app](https://github.com/serverless-nextjs/serverless-next.js/tree/master/packages/e2e-tests/next-app).
3. Run `yarn install` to ensure dependencies such as Cypress are installed.
4. Run `AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx serverless` (or `npx serverless`) to deploy your changes to your AWS account.
5. Save the output CloudFront distribution URL somewhere.
6. Run the Cypress tests using the following command, replacing `CYPRESS_BASE_URL` with your CloudFront distribution URL, and `CYPRESS_NEXT_BUILD_ID` with the Next.js build ID:

```bash
CYPRESS_NEXT_BUILD_ID=123 CYPRESS_BASE_URL=https://dxxxxxxxxxxxx.cloudfront.net yarn e2e
```

This will run the tests in headless mode using the [Electron](https://www.electronjs.org/) browser, which is based on Chromium. You can also run it in Chrome by adding arguments `--browser chrome`.

### Deploying to AWS and testing your changes

First, create your own test serverless component app and in the `serverless.yml` point the `component` field to your fork:

```yml
# serverless.yml
nextApp:
  component: "/path/to/your/fork/serverless-next.js/packages/serverless-components/nextjs-component"
  inputs: ...
```

Then from the app simply run `serverless` or `npx serverless` if you don't have the serverless cli installed. For debug logging, pass in `--debug`.

For interactive debugging of the deployment you may launch serverless through node like `node --inspect node_modules/serverless/bin/serverless.js`. From there you may attach and debug as any other Node.js app.

Note: If you are working with a Typescript package make sure you build it (`yarn build`) before deploying ;)

### Updating handler code

If you are updating the handler code, please be mindful of increasing cold start times and/or handler size, especially when adding new dependencies or doing complex operations. Note that JS `require` time has the most impact on cold start times. While code size is also important, it has little effect on cold start times, because Lambda seems to cache the code pretty efficiently - and this can be mitigated by minifying the Next.js build.

Note that Node.js seems to have a minimum cold start time of ~150 ms, even on an hello-world handler. So the idea is to try to optimize everything else as much as possible.

For example, importing the built-in AWS SDK JS v2 at the top of `default-handler.ts` (outside of the handler) via the below:

```ts
import AWS from "aws-sdk";
```

or even just the S3 client:

```ts
import S3 from "aws-sdk/clients/s3";
```

could incur **100 ms** or more cold start times on every handler invocation, even when it's not actually used. Also, although the `aws-sdk` (AWS SDK JS v2) is built into AWS Lambda's Node.js runtime, it is not modularized and will `require` a bunch of unused code. Even if importing just the S3 client, it also takes close to 100 ms because it imports code for all S3 operations, even if you use only one. In traditional server-based environments, we do not have to worry about this as it is a one-time cost, but since Lambda is a serverless environment, containers will get re-initialized and this becomes a performance problem.

See issue here for more information: https://github.com/serverless-nextjs/serverless-next.js/issues/580

Instead, consider dynamically importing only when needed. For example, we use the AWS SDK JS v3 client which for S3:

```ts
const { S3Client } = await import("@aws-sdk/client-s3/S3Client");
const { PutObjectCommand } = await import(
  "@aws-sdk/client-s3/commands/PutObjectCommand"
);
```

We have configured Rollup to be able to bundle dynamic imports into `default-handler` or `api-handler`.

Note: in this example, for `@aws-sdk` (V3), we import from as deep as possible so that Rollup.js will have a minimal bundle size.

For code size, you can use tools like [BundlePhobia](https://bundlephobia.com/) to approximate the cost of adding a new dependency.
