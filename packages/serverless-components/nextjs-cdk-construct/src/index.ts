import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as logs from "@aws-cdk/aws-logs";
import * as s3Deploy from "@aws-cdk/aws-s3-deployment";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import { ARecord, RecordTarget } from "@aws-cdk/aws-route53";
import {
  OriginRequestImageHandlerManifest,
  OriginRequestApiHandlerManifest,
  RoutesManifest
} from "@sls-next/lambda-at-edge";
import * as fs from "fs-extra";
import * as path from "path";
import {
  Role,
  ManagedPolicy,
  ServicePrincipal,
  CompositePrincipal
} from "@aws-cdk/aws-iam";
import { Duration, RemovalPolicy } from "@aws-cdk/core";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";
import { OriginRequestQueryStringBehavior } from "@aws-cdk/aws-cloudfront";
import { Props } from "./props";
import { toLambdaOption } from "./utils";

export * from "./props";

export class NextJSLambdaEdge extends cdk.Construct {
  private routesManifest: RoutesManifest | null;

  private apiBuildManifest: OriginRequestApiHandlerManifest | null;

  private imageManifest: OriginRequestImageHandlerManifest | null;

  public distribution: cloudfront.Distribution;

  constructor(scope: cdk.Construct, id: string, private props: Props) {
    super(scope, id);
    this.apiBuildManifest = this.readApiBuildManifest();
    this.routesManifest = this.readRoutesManifest();
    this.imageManifest = this.readImageBuildManifest();
    const bucket = new s3.Bucket(this, "PublicAssets", {
      publicReadAccess: true
    });

    const edgeLambdaRole = new Role(this, "NextEdgeLambdaRole", {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com"),
        new ServicePrincipal("edgelambda.amazonaws.com")
      ),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          "NextApiLambdaPolicy",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        )
      ]
    });

    const defaultNextLambda = new lambda.Function(this, "NextLambda", {
      description: `Default Lambda@Edge for Next CloudFront distribution`,
      handler: "index.handler",
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY // destroy old versions
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      code: lambda.Code.fromAsset(
        path.join(this.props.serverlessBuildOutDir, "default-lambda")
      ),
      role: edgeLambdaRole,
      runtime:
        toLambdaOption("defaultLambda", props.runtime) ||
        lambda.Runtime.NODEJS_12_X,
      memorySize: toLambdaOption("defaultLambda", props.memory),
      timeout: toLambdaOption("defaultLambda", props.timeout)
    });

    defaultNextLambda.currentVersion.addAlias("live");

    const apis = this.apiBuildManifest?.apis;
    const hasAPIPages =
      apis &&
      (Object.keys(apis.nonDynamic).length > 0 ||
        Object.keys(apis.dynamic).length > 0);

    let nextApiLambda = null;
    if (hasAPIPages) {
      nextApiLambda = new lambda.Function(this, "NextApiLambda", {
        description: `Default Lambda@Edge for Next API CloudFront distribution`,
        handler: "index.handler",
        currentVersionOptions: {
          removalPolicy: RemovalPolicy.DESTROY, // destroy old versions
          retryAttempts: 1 // async retry attempts
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
        code: lambda.Code.fromAsset(
          path.join(this.props.serverlessBuildOutDir, "api-lambda")
        ),
        role: edgeLambdaRole,
        runtime:
          toLambdaOption("apiLambda", props.runtime) ||
          lambda.Runtime.NODEJS_12_X,
        memorySize: toLambdaOption("apiLambda", props.memory),
        timeout: toLambdaOption("apiLambda", props.timeout)
      });
      nextApiLambda.currentVersion.addAlias("live");
    }

    let nextImageLambda = null;
    if (this.imageManifest) {
      nextImageLambda = new lambda.Function(this, "NextImageLambda", {
        description: `Default Lambda@Edge for Next Image CloudFront distribution`,
        handler: "index.handler",
        currentVersionOptions: {
          removalPolicy: RemovalPolicy.DESTROY, // destroy old versions
          retryAttempts: 1 // async retry attempts
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
        code: lambda.Code.fromAsset(
          path.join(this.props.serverlessBuildOutDir, "image-lambda")
        ),
        role: edgeLambdaRole,
        runtime:
          toLambdaOption("imageLambda", props.runtime) ||
          lambda.Runtime.NODEJS_12_X,
        memorySize: toLambdaOption("imageLambda", props.memory),
        timeout: toLambdaOption("imageLambda", props.timeout)
      });
      nextImageLambda.currentVersion.addAlias("live");
    }

    const nextStaticsCachePolicy = new cloudfront.CachePolicy(
      this,
      "NextStaticsCache",
      {
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        defaultTtl: Duration.days(30),
        maxTtl: Duration.days(30),
        minTtl: Duration.days(30),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true
      }
    );

    const nextImageCachePolicy = new cloudfront.CachePolicy(
      this,
      "NextImageCache",
      {
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Accept"),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        defaultTtl: Duration.days(1),
        maxTtl: Duration.days(365),
        minTtl: Duration.days(0),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true
      }
    );

    const nextLambdaCachePolicy = new cloudfront.CachePolicy(
      this,
      "NextLambdaCache",
      {
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        cookieBehavior: {
          behavior: props.whiteListedCookies?.length ? "whitelist" : "all",
          cookies: props.whiteListedCookies
        },
        defaultTtl: Duration.seconds(0),
        maxTtl: Duration.days(365),
        minTtl: Duration.seconds(0),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true
      }
    );

    const edgeLambdas = [
      {
        includeBody: true,
        eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
        functionVersion: defaultNextLambda.currentVersion
      },
      {
        eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
        functionVersion: defaultNextLambda.currentVersion
      }
    ];

    this.distribution = new cloudfront.Distribution(
      this,
      "NextJSDistribution",
      {
        enableLogging: props.withLogging ? true : undefined,
        certificate: props.domain?.certificate,
        domainNames: props.domain ? [props.domain.domainName] : undefined,
        defaultRootObject: "",
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: new origins.S3Origin(bucket),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          compress: true,
          cachePolicy: nextLambdaCachePolicy,
          edgeLambdas
        },
        additionalBehaviors: {
          ...(nextImageLambda
            ? {
                [this.pathPattern("_next/image*")]: {
                  viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                  origin: new origins.S3Origin(bucket),
                  allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                  cachedMethods:
                    cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                  compress: true,
                  cachePolicy: nextImageCachePolicy,
                  originRequestPolicy: new cloudfront.OriginRequestPolicy(
                    this,
                    "ImageOriginRequest",
                    {
                      queryStringBehavior: OriginRequestQueryStringBehavior.all()
                    }
                  ),
                  edgeLambdas: [
                    {
                      eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                      functionVersion: nextImageLambda.currentVersion
                    }
                  ]
                }
              }
            : {}),
          [this.pathPattern("_next/data/*")]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: new origins.S3Origin(bucket),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: nextLambdaCachePolicy,
            edgeLambdas
          },
          [this.pathPattern("_next/*")]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: new origins.S3Origin(bucket),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: nextStaticsCachePolicy
          },
          [this.pathPattern("static/*")]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: new origins.S3Origin(bucket),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: nextStaticsCachePolicy
          },
          ...(nextApiLambda
            ? {
                [this.pathPattern("api/*")]: {
                  viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                  origin: new origins.S3Origin(bucket),
                  allowedMethods:
                    cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                  cachedMethods:
                    cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                  compress: true,
                  cachePolicy: nextLambdaCachePolicy,
                  edgeLambdas: [
                    {
                      eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                      functionVersion: nextApiLambda.currentVersion
                    }
                  ]
                }
              }
            : {})
        }
      }
    );

    const staticAssets = this.getStaticAssetsFromBuild();
    Object.keys(staticAssets).forEach((staticAssetKey) => {
      const staticAsset =
        staticAssets[staticAssetKey as keyof typeof staticAssets];
      const assetPath = path.join(
        this.props.serverlessBuildOutDir,
        "assets",
        staticAsset
      );
      if (!fs.existsSync(assetPath)) return;
      new s3Deploy.BucketDeployment(this, `AssetDeployment_${staticAssetKey}`, {
        destinationBucket: bucket,
        distribution: this.distribution,
        destinationKeyPrefix: staticAsset,
        distributionPaths: ["/*"],
        sources: [s3Deploy.Source.asset(assetPath)],
        cacheControl: [
          s3Deploy.CacheControl.setPublic(),
          s3Deploy.CacheControl.maxAge(cdk.Duration.days(365)),
          s3Deploy.CacheControl.fromString("immutable")
        ]
      });
    });

    if (props.domain) {
      new ARecord(this, "AliasRecord", {
        recordName: props.domain.domainName,
        zone: props.domain.hostedZone,
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution))
      });
    }
  }

  private pathPattern(pattern: string): string {
    const { basePath } = this.routesManifest || {};
    return basePath && basePath.length > 0
      ? `${basePath.slice(1)}/${pattern}`
      : pattern;
  }

  private readRoutesManifest(): RoutesManifest {
    return fs.readJSONSync(
      path.join(
        this.props.serverlessBuildOutDir,
        "default-lambda/routes-manifest.json"
      )
    );
  }

  private readApiBuildManifest(): OriginRequestApiHandlerManifest | null {
    const apiPath = path.join(
      this.props.serverlessBuildOutDir,
      "api-lambda/manifest.json"
    );
    if (!fs.existsSync(apiPath)) return null;
    return fs.readJsonSync(apiPath);
  }

  private readImageBuildManifest(): OriginRequestImageHandlerManifest | null {
    const imageLambdaPath = path.join(
      this.props.serverlessBuildOutDir,
      "image-lambda/manifest.json"
    );

    return fs.existsSync(imageLambdaPath)
      ? fs.readJSONSync(imageLambdaPath)
      : null;
  }

  private getStaticAssetsFromBuild() {
    const nextStaticFilesPath = path.join("_next", "static");
    const nextDataFilesPath = path.join("_next", "data");
    const htmlPagesPath = path.join("static-pages");
    const publicFilesPath = path.join("public");
    const staticFilesPath = path.join("static");
    return {
      nextStaticFilesPath,
      nextDataFilesPath,
      htmlPagesPath,
      publicFilesPath,
      staticFilesPath
    };
  }
}
