import "@aws-cdk/assert/jest";
import { SynthUtils } from "@aws-cdk/assert";
import { Stack } from "@aws-cdk/core";
import path from "path";
import { NextJSLambdaEdge } from "../src";
import { Runtime } from "@aws-cdk/aws-lambda";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { HostedZone } from "@aws-cdk/aws-route53";

describe("CDK Construct", () => {
  it("passes correct lambda options to underlying lambdas when single value passed", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate"),
      runtime: Runtime.NODEJS_10_X
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextDefaultLambda",
      Runtime: Runtime.NODEJS_10_X.name
    });
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextApiLambda",
      Runtime: Runtime.NODEJS_10_X.name
    });
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextImageLambda",
      Runtime: Runtime.NODEJS_10_X.name
    });
  });

  it("passes correct lambda options to underlying lambdas when object passed", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate"),
      runtime: {
        defaultLambda: Runtime.PYTHON_3_8,
        apiLambda: Runtime.GO_1_X,
        imageLambda: Runtime.JAVA_8_CORRETTO
      }
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextDefaultLambda",
      Runtime: Runtime.PYTHON_3_8.name
    });
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextApiLambda",
      Runtime: Runtime.GO_1_X.name
    });
    expect(synthesizedStack).toHaveResourceLike("AWS::Lambda::Function", {
      FunctionName: "NextImageLambda",
      Runtime: Runtime.JAVA_8_CORRETTO.name
    });
  });

  it("lambda cache policy passes correct cookies to origin when specified", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate"),
      whiteListedCookies: ["my-cookie"]
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toHaveResourceLike(
      "AWS::CloudFront::CachePolicy",
      {
        CachePolicyConfig: {
          Name: "NextLambdaCache",
          ParametersInCacheKeyAndForwardedToOrigin: {
            CookiesConfig: {
              CookieBehavior: "whitelist",
              Cookies: ["my-cookie"]
            }
          }
        }
      }
    );
  });

  it("lambda cache policy passes all cookies to origin when not specified", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toHaveResourceLike(
      "AWS::CloudFront::CachePolicy",
      {
        CachePolicyConfig: {
          Name: "NextLambdaCache",
          ParametersInCacheKeyAndForwardedToOrigin: {
            CookiesConfig: {
              CookieBehavior: "all"
            }
          }
        }
      }
    );
  });

  it("creates resources required for a custom domain when specified", () => {
    const stack = new Stack();
    const certificate = Certificate.fromCertificateArn(
      stack,
      "Cert",
      "arn:partition:service:us-east-1:1234578:abc"
    );
    const domainName = "domain.com";
    const hostedZone = HostedZone.fromHostedZoneAttributes(stack, "Zone", {
      hostedZoneId: "123",
      zoneName: domainName
    });
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate"),
      domain: {
        certificate,
        domainName,
        hostedZone
      }
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toHaveResourceLike(
      "AWS::CloudFront::Distribution",
      {
        DistributionConfig: {
          Aliases: ["domain.com"],
          ViewerCertificate: {
            AcmCertificateArn: "arn:partition:service:us-east-1:1234578:abc"
          }
        }
      }
    );

    expect(synthesizedStack).toHaveResourceLike("AWS::Route53::RecordSet", {
      Name: "domain.com.",
      Type: "A",
      AliasTarget: {
        DNSName: {
          "Fn::GetAtt": ["StackNextJSDistribution03A07E47", "DomainName"]
        },
        HostedZoneId: {
          "Fn::FindInMap": [
            "AWSCloudFrontPartitionHostedZoneIdMap",
            {
              Ref: "AWS::Partition"
            },
            "zoneId"
          ]
        }
      },
      HostedZoneId: "123"
    });
  });

  it("does not create Route53 records when no domain specified", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toCountResources("AWS::Route53::RecordSet", 0);
  });
});
