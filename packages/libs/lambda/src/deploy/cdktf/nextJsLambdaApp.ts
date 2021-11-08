import {
  APIGatewayV2,
  AwsProvider,
  CloudFront,
  IAM,
  LambdaFunction,
  S3,
  SQS
} from "@cdktf/provider-aws";
import { App, Fn, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import {
  ArchiveProvider,
  DataArchiveFile
} from "src/deploy/cdktf/.gen/providers/archive";
import { Resource } from "src/deploy/cdktf/.gen/providers/null";
import * as path from "path";
import { CoreBuildOptions } from "@sls-next/core";
import { LambdaBuildOptions } from "src/types";

const DEFAULT_OUTPUT_DIR = ".serverless_nextjs";
const DEFAULT_AWS_REGION = "us-east-1";

export type NextJsLambdaAppProps = {
  /**
   * The app name. This will prefix names of various infrastructure such as Lambda, S3 bucket, SQS queue, etc.
   * Please ensure the name only contains alphanumeric characters and dashes to be compatible across all resources.
   */
  appName: string;
  /**
   * The AWS region to provision the Next.js app infrastructure.
   * If omitted, it will default to us-east-1.
   */
  region?: string;
  coreBuildOptions?: CoreBuildOptions;
  lambdaBuildOptions?: LambdaBuildOptions;
  imageLambdaPolicyConfig?: Partial<IAM.IamPolicyConfig>;
  defaultLambdaPolicyConfig?: Partial<IAM.IamPolicyConfig>;
  s3BucketConfig?: Partial<S3.S3BucketConfig>;
  apiGatewayApiConfig?: Partial<APIGatewayV2.Apigatewayv2ApiConfig>;
  apiGatewayApiMainStageConfig?: Partial<APIGatewayV2.Apigatewayv2StageConfig>;
  apiGatewayDefaultRouteConfig?: Partial<APIGatewayV2.Apigatewayv2RouteConfig>;
  apiGatewayImageRouteConfig?: Partial<APIGatewayV2.Apigatewayv2RouteConfig>;
  apiGatewayDefaultIntegrationConfig?: Partial<APIGatewayV2.Apigatewayv2IntegrationConfig>;
  apiGatewayImageIntegrationConfig?: Partial<APIGatewayV2.Apigatewayv2IntegrationConfig>;
  domainConfig?: Partial<APIGatewayV2.Apigatewayv2DomainNameConfig>;
  defaultLambdaConfig?: Partial<LambdaFunction.LambdaFunctionConfig>;
  defaultLambdaPermissionConfig?: Partial<LambdaFunction.LambdaPermissionConfig>;
  defaultLambdaRegenerationEventSourceMappingConfig?: Partial<LambdaFunction.LambdaEventSourceMapping>;
  defaultLambdaRoleConfig?: Partial<IAM.IamRoleConfig>;
  imageLambdaConfig?: Partial<LambdaFunction.LambdaFunctionConfig>;
  imageLambdaPermissionConfig?: Partial<LambdaFunction.LambdaPermissionConfig>;
  imageLambdaRoleConfig?: Partial<IAM.IamRoleConfig>;
  regenerationQueueConfig?: Partial<SQS.SqsQueueConfig>;
  regenerationQueuePolicyConfig?: Partial<SQS.SqsQueuePolicyConfig>;
  cloudFrontDistributionConfig?: Partial<CloudFront.CloudfrontDistributionConfig>;
  cloudFrontCachePolicyConfig?: Partial<CloudFront.CloudfrontCachePolicyConfig>;
};

/**
 * A Terraform for CDK construct to deploy Next.js apps to Lambda + API Gateway V2 + CloudFront.
 * This requires minimal configuration to deploy, and nearly all of the Terraform resource configurations can be overridden.
 * Note: this is a work-in-progress and may not function properly.
 * Refer to Terraform docs at {@link https://registry.terraform.io/providers/hashicorp/aws/latest/docs}
 */
export class NextJsLambdaApp extends TerraformStack {
  protected readonly props: NextJsLambdaAppProps;
  protected s3Bucket: S3.S3Bucket;
  protected defaultLambda: LambdaFunction.LambdaFunction;
  protected imageLambda: LambdaFunction.LambdaFunction;
  protected apiGatewayApi: APIGatewayV2.Apigatewayv2Api;
  protected apiGatewayDefaultIntegration: APIGatewayV2.Apigatewayv2Integration;
  protected apiGatewayImageIntegration: APIGatewayV2.Apigatewayv2Integration;
  protected apiGatewayDefaultRoute: APIGatewayV2.Apigatewayv2Route;
  protected apiGatewayImagesRoute: APIGatewayV2.Apigatewayv2Route;
  protected cloudFrontDistribution: CloudFront.CloudfrontDistribution;
  protected regenerationQueue: SQS.SqsQueue;
  protected defaultLambdaRole: IAM.IamRole;
  protected imageLambdaRole: IAM.IamRole;
  protected apiGatewayMainStage: APIGatewayV2.Apigatewayv2Stage;
  protected defaultLambdaZip: DataArchiveFile;
  protected imageLambdaZip: DataArchiveFile;
  protected defaultLambdaPolicy: IAM.IamPolicy;
  protected imageLambdaPolicy: IAM.IamPolicy;
  protected uploadAssetsResource: Resource;
  protected defaultLambdaRegenerationEventSourceMapping: LambdaFunction.LambdaEventSourceMapping;
  protected defaultLambdaPermission: LambdaFunction.LambdaPermission;
  protected imageLambdaPermission: LambdaFunction.LambdaPermission;
  protected cloudFrontCachePolicy: CloudFront.CloudfrontCachePolicy;
  protected buildResource: Resource;
  protected invalidateCloudFrontResource: Resource;

  public constructor(
    scope: Construct,
    id: string,
    props: NextJsLambdaAppProps
  ) {
    super(scope, id);
    this.props = props;

    const coreBuildOptions: CoreBuildOptions = {
      outputDir: DEFAULT_OUTPUT_DIR,
      nextConfigDir: "./"
    };
    const lambdaBuildOptions: LambdaBuildOptions = {
      bucketName:
        this.props.s3BucketConfig?.bucket ??
        `${this.props.appName}-sls-next-bucket`,
      bucketRegion: this.props.region ?? DEFAULT_AWS_REGION
    };

    // Build app using LambdaBuilder if we are supposed to build (see if this can be a TerraForm null resource component
    // Note that the code can't be executed directly since we are using Terraform to apply the changes, so we need to
    // FIXME: implement this script
    this.buildResource = new Resource(this, "BuildResource", {});
    this.buildResource.addOverride("provisioner", [
      {
        "local-exec": {
          command: `node ${__dirname}/dist/build/scripts/buildApp.js --coreBuildOptions ${JSON.stringify(
            coreBuildOptions
          )} --lambdaBuildOptions ${JSON.stringify(lambdaBuildOptions)}`
        }
      }
    ]);

    // Zip up code
    new ArchiveProvider(this, "Archive");

    this.defaultLambdaZip = new DataArchiveFile(this, "DefaultLambdaZip", {
      sourceDir: path.join(
        coreBuildOptions.outputDir ?? DEFAULT_OUTPUT_DIR,
        "default-lambda"
      ),
      outputPath: "default-lambda.zip",
      type: "zip"
    });

    this.imageLambdaZip = new DataArchiveFile(this, "ImageLambdaZip", {
      sourceDir: path.join(
        coreBuildOptions.outputDir ?? DEFAULT_OUTPUT_DIR,
        "image-lambda"
      ),
      outputPath: "image-lambda.zip",
      type: "zip"
    });

    // Create infrastructure all within the same region, or us-east-1 if not specified
    new AwsProvider(this, "AWS", {
      region: this.props.region ?? DEFAULT_AWS_REGION
    });

    // S3 bucket
    this.s3Bucket = this.createS3Bucket();

    // Upload assets. We don't use the S3.S3BucketObject resources since it will force S3 state to be the same as the source,
    // so previous assets may be lost. Instead, we execute a script via a custom resource which will retain the last 2 versions
    // and delete other old resources.
    // FIXME: implement this script
    this.uploadAssetsResource = new Resource(this, "UploadAssetsResource", {
      dependsOn: [this.s3Bucket]
    });
    this.uploadAssetsResource.addOverride("provisioner", [
      {
        "local-exec": {
          command: `node ${__dirname}/dist/deploy/cdktf/scripts/uploadAssets.js --coreBuildOptions ${JSON.stringify(
            props.coreBuildOptions
          )} --lambdaBuildOptions ${JSON.stringify(props.lambdaBuildOptions)}`
        }
      }
    ]);

    // SQS queue for regeneration
    this.regenerationQueue = this.createRegenerationQueue();

    // Default lambda which also handles regeneration requests
    this.defaultLambdaPolicy = this.createDefaultLambdaPolicy();
    this.defaultLambdaRole = this.createDefaultLambdaRole();
    this.defaultLambda = this.createDefaultLambda();
    this.defaultLambdaRegenerationEventSourceMapping =
      this.createDefaultLambdaRegenerationEventSourceMapping();

    // Image lambda for image optimization
    this.imageLambdaPolicy = this.createImageLambdaPolicy();
    this.imageLambdaRole = this.createImageLambdaRole();
    this.imageLambda = this.createImageLambda();

    // API Gateway V2
    this.apiGatewayApi = this.createAPIGatewayApi();
    this.apiGatewayMainStage = this.createAPIGatewayMainStage();

    // Permissions for API Gateway to invoke Lambda
    this.defaultLambdaPermission = this.createDefaultLambdaPermission();
    this.imageLambdaPermission = this.createImageLambdaPermission();

    // API Gateway Lambda Integrations
    this.apiGatewayDefaultIntegration =
      this.createAPIGatewayDefaultIntegration();
    this.apiGatewayImageIntegration = this.createAPIGatewayImageIntegration();

    // API Gateway Routes
    this.apiGatewayDefaultRoute = this.createAPIGatewayDefaultRoute();
    this.apiGatewayImagesRoute = this.createAPIGatewayImageRoute();

    // CloudFront distribution created on top of API Gateway V2 for caching static files purposes
    this.cloudFrontCachePolicy = this.createCloudFrontCachePolicy();
    this.cloudFrontDistribution = this.createCloudFrontDistribution();

    // Run custom script to invalidate CF distribution, since there is no Terraform resource to do so but we need to do it each time.
    // FIXME: implement this script and allow custom paths
    const invalidationPaths = ["/*"];
    this.invalidateCloudFrontResource = new Resource(
      this,
      "invalidateCloudFrontResource",
      {
        dependsOn: [this.defaultLambda, this.imageLambda, this.apiGatewayApi]
      }
    );
    this.invalidateCloudFrontResource.addOverride("provisioner", [
      {
        "local-exec": {
          command: `node ./dist/deploy/scripts/invalidateCloudFrontDistribution.js --paths ${JSON.stringify(
            invalidationPaths
          )}`
        }
      }
    ]);
  }

  /**
   * Create an API Gateway V2 HTTP API which will serve all Next.js requests.
   * @protected
   */
  protected createAPIGatewayApi(): APIGatewayV2.Apigatewayv2Api {
    const apiGatewayApiConfig: APIGatewayV2.Apigatewayv2ApiConfig = {
      name: `${this.props.appName}-sls-next-api-gateway`,
      description: `${this.props.appName} API Gateway`,
      protocolType: "HTTP"
    };

    Object.assign(apiGatewayApiConfig, this.props.apiGatewayApiConfig);
    return new APIGatewayV2.Apigatewayv2Api(
      this,
      "ApiGateway",
      apiGatewayApiConfig
    );
  }

  protected createAPIGatewayMainStage(): APIGatewayV2.Apigatewayv2Stage {
    const apiGatewayApiMainStageConfig: APIGatewayV2.Apigatewayv2StageConfig = {
      apiId: this.apiGatewayApi.id,
      name: "main",
      autoDeploy: true
    };

    Object.assign(
      apiGatewayApiMainStageConfig,
      this.props.apiGatewayApiMainStageConfig
    );
    return new APIGatewayV2.Apigatewayv2Stage(
      this,
      "ApiGatewayMainStage",
      apiGatewayApiMainStageConfig
    );
  }

  protected createS3Bucket(): S3.S3Bucket {
    const s3BucketConfig: S3.S3BucketConfig = {
      bucket: `${this.props.appName}-sls-next-bucket`,
      accelerationStatus: "Enabled"
    };

    Object.assign(s3BucketConfig, this.props.s3BucketConfig);

    return new S3.S3Bucket(this, "NextJsS3Bucket", s3BucketConfig);
  }

  protected createDefaultLambda(): LambdaFunction.LambdaFunction {
    const lambdaConfig: LambdaFunction.LambdaFunctionConfig = {
      functionName: `${this.props.appName}-sls-next-default-lambda`,
      role: this.defaultLambdaRole.arn,
      memorySize: 512,
      runtime: "nodejs14.x",
      handler: "index.handler",
      description: `${this.props.appName} Default Lambda`,
      timeout: 15,
      filename: this.defaultLambdaZip.outputPath,
      sourceCodeHash: this.defaultLambdaZip.outputBase64Sha256
    };

    Object.assign(lambdaConfig, this.props.defaultLambdaConfig);

    return new LambdaFunction.LambdaFunction(
      this,
      "DefaultLambda",
      lambdaConfig
    );
  }

  protected createImageLambda(): LambdaFunction.LambdaFunction {
    const lambdaConfig: LambdaFunction.LambdaFunctionConfig = {
      functionName: `${this.props.appName}-sls-next-image-lambda`,
      role: this.imageLambdaRole.arn,
      memorySize: 512,
      runtime: "nodejs14.x",
      handler: "index.handler",
      description: `${this.props.appName} Image Lambda`,
      timeout: 15,
      filename: this.imageLambdaZip.outputPath,
      sourceCodeHash: this.imageLambdaZip.outputBase64Sha256
    };

    Object.assign(lambdaConfig, this.props.imageLambdaConfig);

    return new LambdaFunction.LambdaFunction(this, "ImageLambda", lambdaConfig);
  }

  protected createRegenerationQueue(): SQS.SqsQueue {
    const regenerationQueueConfig: SQS.SqsQueueConfig = {
      name: `${this.props.appName}-sls-next-regen-queue.fifo`,
      fifoQueue: true
    };

    Object.assign(regenerationQueueConfig, this.props.regenerationQueueConfig);

    return new SQS.SqsQueue(this, "RegenerationQueue", regenerationQueueConfig);
  }

  protected createRegenerationQueuePolicy(): SQS.SqsQueuePolicyConfig {
    const regenerationQueuePolicyConfig: SQS.SqsQueuePolicyConfig = {
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "RegenerationQueueStatement",
            Effect: "Allow",
            Principal: `${this.defaultLambdaRole.id}`,
            Action: "sqs:SendMessage",
            Resource: `${this.regenerationQueue.arn}`
          }
        ]
      }),
      queueUrl: this.regenerationQueue.url
    };

    Object.assign(
      regenerationQueuePolicyConfig,
      this.props.regenerationQueuePolicyConfig
    );

    return regenerationQueuePolicyConfig;
  }

  protected createCloudFrontDistribution(): CloudFront.CloudfrontDistribution {
    const cloudFrontDistributionConfig: CloudFront.CloudfrontDistributionConfig =
      {
        defaultCacheBehavior: {
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT"
          ],
          cachedMethods: ["GET", "HEAD"],
          targetOriginId: this.apiGatewayApi.id,
          viewerProtocolPolicy: "redirect-to-https",
          compress: true,
          cachePolicyId: this.cloudFrontCachePolicy.id
        },
        enabled: true,
        origin: [
          {
            customOriginConfig: {
              httpPort: 80,
              httpsPort: 443,
              originProtocolPolicy: "https-only",
              originSslProtocols: ["TLSv1.2"]
            },
            domainName: Fn.replace(
              this.apiGatewayApi.apiEndpoint,
              "https://",
              ""
            ),
            originId: this.apiGatewayApi.id,
            originPath: `/${this.apiGatewayMainStage.name}`
          }
        ],
        restrictions: { geoRestriction: { restrictionType: "none" } },
        viewerCertificate: { cloudfrontDefaultCertificate: true }
      };

    Object.assign(
      cloudFrontDistributionConfig,
      this.props.cloudFrontDistributionConfig
    );

    return new CloudFront.CloudfrontDistribution(
      this,
      "CloudFrontDistribution",
      cloudFrontDistributionConfig
    );
  }

  protected createCloudFrontCachePolicy(): CloudFront.CloudfrontCachePolicy {
    const cloudFrontCachePolicyConfig: CloudFront.CloudfrontCachePolicyConfig =
      {
        name: `${this.props.appName}-cache-policy`,
        comment: `${this.props.appName} cache policy`,
        defaultTtl: 0,
        minTtl: 0,
        maxTtl: 31536000,
        parametersInCacheKeyAndForwardedToOrigin: {
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
          cookiesConfig: {
            cookieBehavior: "all"
          },
          headersConfig: {
            headerBehavior: "whitelist",
            headers: {
              items: ["Accept", "Accept-Language", "Authorization"]
            }
          },
          queryStringsConfig: {
            queryStringBehavior: "all"
          }
        }
      };

    Object.assign(
      cloudFrontCachePolicyConfig,
      this.props.cloudFrontCachePolicyConfig
    );

    return new CloudFront.CloudfrontCachePolicy(
      this,
      "CloudFrontCachePolicy",
      cloudFrontCachePolicyConfig
    );
  }

  protected createAPIGatewayDefaultRoute(): APIGatewayV2.Apigatewayv2Route {
    const apiGatewayDefaultRouteConfig: APIGatewayV2.Apigatewayv2RouteConfig = {
      apiId: this.apiGatewayApi.id,
      routeKey: "$default",
      target: `integrations/${this.apiGatewayDefaultIntegration.id}`
    };

    Object.assign(
      apiGatewayDefaultRouteConfig,
      this.props.apiGatewayDefaultRouteConfig
    );

    return new APIGatewayV2.Apigatewayv2Route(
      this,
      "ApiGatewayDefaultRoute",
      apiGatewayDefaultRouteConfig
    );
  }

  protected createAPIGatewayImageRoute(): APIGatewayV2.Apigatewayv2Route {
    const apiGatewayImageRouteConfig: APIGatewayV2.Apigatewayv2RouteConfig = {
      apiId: this.apiGatewayApi.id,
      routeKey: "GET /_next/image",
      target: `integrations/${this.apiGatewayImageIntegration.id}`
    };

    Object.assign(
      apiGatewayImageRouteConfig,
      this.props.apiGatewayImageRouteConfig
    );

    return new APIGatewayV2.Apigatewayv2Route(
      this,
      "ApiGatewayImageRoute",
      apiGatewayImageRouteConfig
    );
  }

  protected createAPIGatewayDefaultIntegration(): APIGatewayV2.Apigatewayv2Integration {
    const apiGatewayDefaultIntegrationConfig: APIGatewayV2.Apigatewayv2IntegrationConfig =
      {
        apiId: this.apiGatewayApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: this.defaultLambda.arn,
        integrationMethod: "POST",
        payloadFormatVersion: "2.0"
      };

    Object.assign(
      apiGatewayDefaultIntegrationConfig,
      this.props.apiGatewayDefaultIntegrationConfig
    );

    return new APIGatewayV2.Apigatewayv2Integration(
      this,
      "ApiGatewayDefaultIntegration",
      apiGatewayDefaultIntegrationConfig
    );
  }

  protected createDefaultLambdaPermission(): LambdaFunction.LambdaPermission {
    const defaultLambdaPermissionConfig: LambdaFunction.LambdaPermissionConfig =
      {
        statementId: "AllowExecutionFromAPIGateway",
        action: "lambda:InvokeFunction",
        functionName: this.defaultLambda.functionName,
        principal: "apigateway.amazonaws.com"
      };

    Object.assign(
      defaultLambdaPermissionConfig,
      this.props.defaultLambdaPermissionConfig
    );

    return new LambdaFunction.LambdaPermission(
      this,
      "DefaultLambdaPermission",
      defaultLambdaPermissionConfig
    );
  }

  protected createImageLambdaPermission(): LambdaFunction.LambdaPermission {
    const imageLambdaPermissionConfig: LambdaFunction.LambdaPermissionConfig = {
      statementId: "AllowExecutionFromAPIGateway",
      action: "lambda:InvokeFunction",
      functionName: this.imageLambda.functionName,
      principal: "apigateway.amazonaws.com"
    };

    Object.assign(
      imageLambdaPermissionConfig,
      this.props.defaultLambdaPermissionConfig
    );

    return new LambdaFunction.LambdaPermission(
      this,
      "ImageLambdaPermission",
      imageLambdaPermissionConfig
    );
  }

  protected createAPIGatewayImageIntegration(): APIGatewayV2.Apigatewayv2Integration {
    const apiGatewayImageIntegrationConfig: APIGatewayV2.Apigatewayv2IntegrationConfig =
      {
        apiId: this.apiGatewayApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: this.imageLambda.arn,
        integrationMethod: "POST",
        payloadFormatVersion: "2.0"
      };

    Object.assign(
      apiGatewayImageIntegrationConfig,
      this.props.apiGatewayImageIntegrationConfig
    );

    return new APIGatewayV2.Apigatewayv2Integration(
      this,
      "ApiGatewayImageIntegration",
      apiGatewayImageIntegrationConfig
    );
  }

  // IAM Roles

  protected createDefaultLambdaRole(): IAM.IamRole {
    const defaultLambdaRoleConfig: IAM.IamRoleConfig = {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Sid: "DefaultLambdaAssumeRolePolicy",
            Principal: {
              Service: "lambda.amazonaws.com"
            }
          }
        ]
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        this.defaultLambdaPolicy.arn
      ]
    };

    Object.assign(defaultLambdaRoleConfig, this.props.defaultLambdaRoleConfig);

    return new IAM.IamRole(this, `DefaultLambdaRole`, defaultLambdaRoleConfig);
  }

  protected createImageLambdaRole(): IAM.IamRole {
    const imageLambdaRoleConfig: IAM.IamRoleConfig = {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Sid: "ImageLambdaAssumeRolePolicy",
            Principal: {
              Service: "lambda.amazonaws.com"
            }
          }
        ]
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        this.imageLambdaPolicy.arn
      ]
    };

    Object.assign(imageLambdaRoleConfig, this.props.imageLambdaRoleConfig);

    return new IAM.IamRole(this, `ImageLambdaRole`, imageLambdaRoleConfig);
  }

  protected createDefaultLambdaPolicy(): IAM.IamPolicy {
    const defaultLambdaPolicyConfig: IAM.IamPolicyConfig = {
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "s3:GetObject",
            Effect: "Allow",
            Resource: `${this.s3Bucket.arn}/*`
          },
          {
            Action: "s3:PutObject",
            Effect: "Allow",
            Resource: `${this.s3Bucket.arn}/*`
          },
          {
            Action: "s3:ListBucket",
            Effect: "Allow",
            Resource: this.s3Bucket.arn
          },
          {
            Action: "sqs:SendMessage",
            Effect: "Allow",
            Resource: this.regenerationQueue.arn
          },
          {
            Action: "sqs:ReceiveMessage",
            Effect: "Allow",
            Resource: this.regenerationQueue.arn
          },
          {
            Action: "sqs:DeleteMessage",
            Effect: "Allow",
            Resource: this.regenerationQueue.arn
          },
          {
            Action: "sqs:GetQueueAttributes",
            Effect: "Allow",
            Resource: this.regenerationQueue.arn
          }
        ]
      })
    };

    Object.assign(
      defaultLambdaPolicyConfig,
      this.props.defaultLambdaPolicyConfig
    );

    return new IAM.IamPolicy(
      this,
      "DefaultLambdaPolicy",
      defaultLambdaPolicyConfig
    );
  }

  /**
   * Attach the default lambda to the regeneration queue so it can process regeneration event messages.
   * @protected
   */
  protected createDefaultLambdaRegenerationEventSourceMapping(): LambdaFunction.LambdaEventSourceMapping {
    const defaultLambdaRegenerationEventSourceMappingConfig: LambdaFunction.LambdaEventSourceMappingConfig =
      {
        functionName: this.defaultLambda.arn,
        eventSourceArn: this.regenerationQueue.arn
      };

    Object.assign(
      defaultLambdaRegenerationEventSourceMappingConfig,
      this.props.defaultLambdaRegenerationEventSourceMappingConfig
    );

    return new LambdaFunction.LambdaEventSourceMapping(
      this,
      "DefaultLambdaRegenerationEventSourceMapping",
      defaultLambdaRegenerationEventSourceMappingConfig
    );
  }

  private createImageLambdaPolicy(): IAM.IamPolicy {
    const imageLambdaPolicyConfig: IAM.IamPolicyConfig = {
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "s3:GetObject",
            Effect: "Allow",
            Resource: `${this.s3Bucket.arn}/*`
          },
          {
            Action: "s3:ListBucket",
            Effect: "Allow",
            Resource: this.s3Bucket.arn
          }
        ]
      })
    };

    Object.assign(imageLambdaPolicyConfig, this.props.imageLambdaPolicyConfig);

    return new IAM.IamPolicy(
      this,
      "ImageLambdaPolicy",
      imageLambdaPolicyConfig
    );
  }
}
