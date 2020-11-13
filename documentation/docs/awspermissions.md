---
id: awspermissions
title: AWS Permissions
sidebar_label: AWS Permissions
---

By default the Lambda@Edge functions run using AWSLambdaBasicExecutionRole which only allows uploading logs to CloudWatch. If you need permissions beyond this, like for example access to DynamoDB or any other AWS resource you will need your own custom policy arn:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    policy: "arn:aws:iam::123456789012:policy/MyCustomPolicy"
```

Make sure you add CloudWatch log permissions to your custom policy.

The exhaustive list of AWS actions required for a deployment:

```
  "acm:DescribeCertificate", // only for custom domains
  "acm:ListCertificates",    // only for custom domains
  "acm:RequestCertificate",  // only for custom domains
  "cloudfront:CreateCloudFrontOriginAccessIdentity",
  "cloudfront:CreateDistribution",
  "cloudfront:CreateInvalidation",
  "cloudfront:GetDistribution",
  "cloudfront:GetDistributionConfig",
  "cloudfront:ListCloudFrontOriginAccessIdentities",
  "cloudfront:ListDistributions",
  "cloudfront:ListDistributionsByLambdaFunction",
  "cloudfront:ListDistributionsByWebACLId",
  "cloudfront:ListFieldLevelEncryptionConfigs",
  "cloudfront:ListFieldLevelEncryptionProfiles",
  "cloudfront:ListInvalidations",
  "cloudfront:ListPublicKeys",
  "cloudfront:ListStreamingDistributions",
  "cloudfront:UpdateDistribution",
  "iam:AttachRolePolicy",
  "iam:CreateRole",
  "iam:CreateServiceLinkedRole",
  "iam:GetRole",
  "iam:PassRole",
  "lambda:CreateFunction",
  "lambda:EnableReplication",
  "lambda:DeleteFunction",            // only for custom domains
  "lambda:GetFunction",
  "lambda:GetFunctionConfiguration",
  "lambda:PublishVersion",
  "lambda:UpdateFunctionCode",
  "lambda:UpdateFunctionConfiguration",
  "route53:ChangeResourceRecordSets", // only for custom domains
  "route53:ListHostedZonesByName",
  "route53:ListResourceRecordSets",   // only for custom domains
  "s3:CreateBucket",
  "s3:GetAccelerateConfiguration",
  "s3:GetObject",                     // only if persisting state to S3 for CI/CD
  "s3:HeadBucket",
  "s3:ListBucket",
  "s3:PutAccelerateConfiguration",
  "s3:PutBucketPolicy",
  "s3:PutObject"
```
