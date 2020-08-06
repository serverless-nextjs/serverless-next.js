import path from "path";
import { Construct } from "@aws-cdk/core";
import {
  CloudFrontWebDistributionProps,
  CloudFrontWebDistribution,
  LambdaEdgeEventType,
  Behavior
} from "@aws-cdk/aws-cloudfront";
import { Bucket, IBucket } from "@aws-cdk/aws-s3";
import { Code, Function, FunctionProps, Runtime } from "@aws-cdk/aws-lambda";

type NextjsConstructProps = {
  cloudFrontDistributionProps: CloudFrontWebDistributionProps;
  defaultLambdaProps?: FunctionProps;
  assetsBucket: IBucket;
  nextConfigDir: string;
};

export class NextjsConstruct extends Construct {
  constructor(
    scope: Construct,
    {
      cloudFrontDistributionProps,
      assetsBucket,
      defaultLambdaProps,
      nextConfigDir
    }: NextjsConstructProps
  ) {
    super(scope, "ServerlessNextjsCDK");

    const defaultCacheBehaviour: Behavior = {
      isDefaultBehavior: true,
      lambdaFunctionAssociations: []
    };

    cloudFrontDistributionProps.originConfigs.push({
      s3OriginSource: {
        s3BucketSource: Bucket.fromBucketAttributes(
          this,
          "ServerlessNextjsAssetsBucket",
          {
            bucketName: assetsBucket.bucketName,
            bucketRegionalDomainName: assetsBucket.bucketRegionalDomainName
          }
        )
      },
      behaviors: [
        {
          isDefaultBehavior: false,
          pathPattern: "_next/static/*"
        },
        defaultCacheBehaviour
      ]
    });

    const lambdaFunction = new Function(
      this,
      "DefaultLambda",
      defaultLambdaProps || {
        functionName: "ServerlessNextjsDefaultLambda",
        runtime: Runtime.NODEJS_12_X,
        code: Code.fromAsset(
          path.join(nextConfigDir, ".serverless_nextjs/default-handler")
        ),
        handler: "index.handler"
      }
    );

    defaultCacheBehaviour.lambdaFunctionAssociations.push({
      eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
      lambdaFunction: lambdaFunction.latestVersion
    });

    new CloudFrontWebDistribution(
      this,
      "CloudFrontDistribution",
      cloudFrontDistributionProps
    );
  }
}
