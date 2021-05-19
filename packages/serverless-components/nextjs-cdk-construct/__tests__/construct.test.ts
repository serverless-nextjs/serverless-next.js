import "@aws-cdk/assert/jest";
import { SynthUtils } from "@aws-cdk/assert";
import { Stack } from "@aws-cdk/core";
import path from "path";
import { NextJSLambdaEdge } from "../src";
import { Runtime, Function, Code } from "@aws-cdk/aws-lambda";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { HostedZone } from "@aws-cdk/aws-route53";
import { LambdaEdgeEventType } from "@aws-cdk/aws-cloudfront";

describe("CDK Construct", () => {
  it("passes correct lambda options to underlying lambdas when single value passed", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      runtime: Runtime.NODEJS_10_X,
      name: {
        defaultLambda: "NextDefaultLambda",
        apiLambda: "NextApiLambda",
        imageLambda: "NextImageLambda"
      }
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
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      name: {
        defaultLambda: "NextDefaultLambda",
        apiLambda: "NextApiLambda",
        imageLambda: "NextImageLambda"
      },
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
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      whiteListedCookies: ["my-cookie"],
      cachePolicyName: {
        lambdaCache: "NextLambdaCache"
      }
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
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      cachePolicyName: {
        lambdaCache: "NextLambdaCache"
      }
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
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      domain: {
        certificate,
        domainNames: [domainName],
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
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toCountResources("AWS::Route53::RecordSet", 0);
  });

  it("does not create an SQS queue if the app has no ISR pages", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toCountResources("AWS::SQS::Queue", 0);
  });

  it("does create an SQS queue if the app has ISR pages", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app-with-isr")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toCountResources("AWS::SQS::Queue", 1);
  });

  it("configure distribution, but not Route53 records, with custom domain outside AWS", () => {
    const stack = new Stack();
    const certificate = Certificate.fromCertificateArn(
      stack,
      "Cert",
      "arn:partition:service:us-east-1:1234578:abc"
    );
    const domainName = "domain.com";
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      domain: {
        certificate,
        domainNames: [domainName]
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

    expect(synthesizedStack).toCountResources("AWS::Route53::RecordSet", 0);
  });

  it("concatenates edgeLambdas passed to defaultBehavior", () => {
    const stack = new Stack();

    const viewerRequestFunction = new Function(
      stack,
      "ViewerRequestEdgeFunction",
      {
        code: Code.fromInline(`module.handler = () => {}`),
        handler: "index.handler",
        runtime: Runtime.NODEJS_10_X,
        functionName: "viewerRequest-test"
      }
    );

    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app"),
      runtime: Runtime.NODEJS_10_X,
      defaultBehavior: {
        edgeLambdas: [
          {
            functionVersion: viewerRequestFunction.currentVersion,
            eventType: LambdaEdgeEventType.VIEWER_REQUEST
          }
        ]
      }
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);

    expect(synthesizedStack).toHaveResourceLike(
      "AWS::CloudFront::Distribution",
      {
        DistributionConfig: {
          DefaultCacheBehavior: {
            LambdaFunctionAssociations: [
              {
                IncludeBody: true,
                EventType: LambdaEdgeEventType.ORIGIN_REQUEST.toString()
              },
              {
                EventType: LambdaEdgeEventType.ORIGIN_RESPONSE.toString()
              },
              {
                EventType: LambdaEdgeEventType.VIEWER_REQUEST.toString()
              }
            ]
          }
        }
      }
    );
  });
});
