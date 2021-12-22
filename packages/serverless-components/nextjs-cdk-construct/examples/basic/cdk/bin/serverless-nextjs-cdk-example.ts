#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { Builder } from "@sls-next/lambda-at-edge";
import { ServerlessNextjsCdkExampleStack } from '../serverless-nextjs-cdk-example-stack';

const builder = new Builder(".", "./build", { args: ["build"] });
builder.build()
.then(() => {
  const app = new App();
  new ServerlessNextjsCdkExampleStack(app, 'ServerlessNextjsCdkExampleStack', {
    
  });
})
.catch((e) => {
  console.log(e);
  process.exit(1);
});
