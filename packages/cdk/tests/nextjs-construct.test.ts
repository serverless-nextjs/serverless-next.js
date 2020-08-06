import os from "os";
import path from "path";
import { NextjsConstruct } from "../NextjsConstruct";
import { Stack } from "@aws-cdk/core";
import { Bucket, CfnBucket } from "@aws-cdk/aws-s3";
import { mkdirSync, writeFileSync, existsSync } from "fs";

import "@aws-cdk/assert/jest";

const createTestConstruct = (
  stack: Stack
): { nextjsConstruct: NextjsConstruct; bucketLogicalId: string } => {
  const assetsBucket = new Bucket(stack, "test-bucket", {
    bucketName: "test"
  });

  // TODO: remove this once implementation builds the app
  const nextConfigDir = os.tmpdir();
  const slsNextBuildDir = path.join(
    nextConfigDir,
    ".serverless_nextjs/default-handler"
  );
  if (!existsSync(slsNextBuildDir)) {
    mkdirSync(slsNextBuildDir);
  }

  writeFileSync(
    path.join(nextConfigDir, ".serverless_nextjs/default-handler/index.js"),
    "fake impl"
  );

  const nextjsConstruct = new NextjsConstruct(stack, {
    assetsBucket,
    cloudFrontDistributionProps: {
      originConfigs: []
    },
    nextConfigDir
  });

  const bucketLogicalId = stack.getLogicalId(
    assetsBucket.node.defaultChild as CfnBucket
  );

  return {
    bucketLogicalId,
    nextjsConstruct
  };
};

describe("Nextjs Construct", () => {
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack();
  });

  describe("CloudFront distribution changes", () => {
    it("adds S3 origin for static assets using bucket provided", () => {
      const { bucketLogicalId } = createTestConstruct(stack);

      expect(stack).toHaveResourceLike("AWS::CloudFront::Distribution", {
        DistributionConfig: {
          Origins: [
            {
              DomainName: {
                "Fn::GetAtt": [`${bucketLogicalId}`, "RegionalDomainName"]
              }
            }
          ]
        }
      });
    });

    it("adds cache behaviour for nextjs client side resources", () => {
      createTestConstruct(stack);

      expect(stack).toHaveResourceLike("AWS::CloudFront::Distribution", {
        DistributionConfig: {
          CacheBehaviors: [
            {
              PathPattern: "_next/static/*"
            }
          ]
        }
      });
    });

    it("adds lambda@edge association to default cache behaviour for server side rendering and routing", () => {
      createTestConstruct(stack);

      expect(stack).toHaveResourceLike("AWS::CloudFront::Distribution", {
        DistributionConfig: {
          DefaultCacheBehavior: {
            LambdaFunctionAssociations: [
              {
                EventType: "origin-request",
                LambdaFunctionARN: {
                  "Fn::Join": [
                    "",
                    [
                      {
                        // TODO: can't assert on this part due the random CDK suffix
                        //"Fn::GetAtt": [
                        //"ServerlessNextjsCDKDefaultLambdaC7FA79F7",
                        //"Arn"
                        //]
                      },
                      ":$LATEST"
                    ]
                  ]
                }
              }
            ]
          }
        }
      });
    });
  });
});
