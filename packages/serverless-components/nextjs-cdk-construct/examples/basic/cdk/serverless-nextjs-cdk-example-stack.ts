import * as cdk from '@aws-cdk/core';
import { NextJSLambdaEdge } from "@sls-next/cdk-construct";

export class ServerlessNextjsCdkExampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const app = new NextJSLambdaEdge(this, "NextJsApp", {
      serverlessBuildOutDir: "./build"
    });
    new cdk.CfnOutput(this, 'Domain', {
      value: app.distribution.domainName,
      description: 'CloudFrontDomain'
    })
    new cdk.CfnOutput(this, 'ID', {
      value: app.distribution.distributionId,
      description: 'DistributionID',
    })
  }
}
