const aws = require("aws-sdk");
const { utils } = require("@serverless/core");

const DEFAULT_MINIMUM_PROTOCOL_VERSION = "TLSv1.2_2018";
const HOSTED_ZONE_ID = "Z2FDTNDATAQYW2"; // this is a constant that you can get from here https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-aliastarget.html

/**
 * Get Clients
 * - Gets AWS SDK clients to use within this Component
 */
const getClients = (credentials, region = "us-east-1") => {
  const route53 = new aws.Route53({
    credentials,
    region
  });

  const acm = new aws.ACM({
    credentials,
    region: "us-east-1" // ACM must be in us-east-1
  });

  const cf = new aws.CloudFront({
    credentials,
    region
  });

  const apig = new aws.APIGateway({
    credentials,
    region
  });

  return {
    route53,
    acm,
    cf,
    apig
  };
};

/**
 * Prepare Domains
 * - Formats component domains & identifies cloud services they're using.
 */
const prepareSubdomains = (inputs) => {
  const subdomains = [];

  for (const subdomain in inputs.subdomains || {}) {
    const domainObj = {};

    domainObj.domain = `${subdomain}.${inputs.domain}`;

    if (inputs.subdomains[subdomain].url.includes("s3")) {
      domainObj.type = "awsS3Website";
      // Get S3 static hosting endpoint of existing bucket to use w/ CloudFront.
      // todo this doesn't work with bucket names with periods
      domainObj.s3BucketName = inputs.subdomains[subdomain].url
        .replace("http://", "")
        .split(".")[0];
    }

    // Check if referenced Component is using AWS API Gateway...
    if (inputs.subdomains[subdomain].url.includes("execute-api")) {
      domainObj.apiId = inputs.subdomains[subdomain].url
        .split(".")[0]
        .split("//")[1];
      domainObj.stage = inputs.subdomains[subdomain].url.split("/")[3];
      domainObj.type = "awsApiGateway";
    }

    // Check if referenced Component is using AppSync...
    if (inputs.subdomains[subdomain].url.includes("appsync")) {
      domainObj.apiId = inputs.subdomains[subdomain].url
        .split(".")[0]
        .split("//")[1];
      domainObj.url = inputs.subdomains[subdomain].url
        .replace("https://", "") // distribution origin does not expect https
        .replace("/graphql", ""); // distribution origin does not expect /graphql
      domainObj.type = "awsAppSync";
    }

    if (inputs.subdomains[subdomain].url.includes("cloudfront")) {
      domainObj.distributionId = inputs.subdomains[subdomain].id;
      domainObj.url = inputs.subdomains[subdomain].url;
      domainObj.type = "awsCloudFront";
    }

    subdomains.push(domainObj);
  }

  return subdomains;
};

const getOutdatedDomains = (inputs, state) => {
  if (inputs.domain !== state.domain) {
    return state;
  }

  const outdatedDomains = {
    domain: state.domain,
    subdomains: []
  };

  for (const domain of state.subdomains) {
    if (!inputs.subdomains[domain.domain]) {
      outdatedDomains.push(domain);
    }
  }

  return outdatedDomains;
};

/**
 * Get Domain Hosted Zone ID
 * - Every Domain on Route53 always has a Hosted Zone w/ 2 Record Sets.
 * - These Record Sets are: "Name Servers (NS)" & "Start of Authority (SOA)"
 * - These don't need to be created and SHOULD NOT be modified.
 */
const getDomainHostedZoneId = async (route53, domain, privateZone) => {
  const hostedZonesRes = await route53.listHostedZonesByName().promise();

  const hostedZone = hostedZonesRes.HostedZones.find(
    // Name has a period at the end, so we're using includes rather than equals
    (zone) =>
      zone.Config.PrivateZone === privateZone && zone.Name.includes(domain)
  );

  if (!hostedZone) {
    throw Error(
      `Domain ${domain} was not found in your AWS account. Please purchase it from Route53 first then try again.`
    );
  }

  return hostedZone.Id.replace("/hostedzone/", ""); // hosted zone id is always prefixed with this :(
};

/**
 * Describe Certificate By Arn
 * - Describe an AWS ACM Certificate by its ARN
 */
const describeCertificateByArn = async (acm, certificateArn) => {
  const certificate = await acm
    .describeCertificate({ CertificateArn: certificateArn })
    .promise();
  return certificate && certificate.Certificate
    ? certificate.Certificate
    : null;
};

/**
 * Get Certificate Arn By Domain
 * - Gets an AWS ACM Certificate by a specified domain or return null
 */
const getCertificateArnByDomain = async (acm, domain) => {
  const listRes = await acm.listCertificates().promise();

  for (const certificate of listRes.CertificateSummaryList) {
    if (certificate.DomainName === domain && certificate.CertificateArn) {
      if (domain.startsWith("www.")) {
        const nakedDomain = domain.replace("wwww.", "");
        // check whether certificate support naked domain
        const certDetail = await describeCertificateByArn(
          acm,
          certificate.CertificateArn
        );
        const nakedDomainCert = certDetail.DomainValidationOptions.find(
          ({ DomainName }) => DomainName === nakedDomain
        );

        if (!nakedDomainCert) {
          continue;
        }
      }

      return certificate.CertificateArn;
    }
  }

  return null;
};

/**
 * Create Certificate
 * - Creates an AWS ACM Certificate for the specified domain
 */
const createCertificate = async (acm, domain) => {
  const wildcardSubDomain = `*.${domain}`;

  const params = {
    DomainName: domain,
    SubjectAlternativeNames: [domain, wildcardSubDomain],
    ValidationMethod: "DNS"
  };

  const res = await acm.requestCertificate(params).promise();

  return res.CertificateArn;
};

/**
 * Validate Certificate
 * - Validate an AWS ACM Certificate via the "DNS" method
 */
const validateCertificate = async (
  acm,
  route53,
  certificate,
  domain,
  domainHostedZoneId
) => {
  let readinessCheckCount = 16;
  let statusCheckCount = 16;
  let validationResourceRecord;

  /**
   * Check Readiness
   * - Newly Created AWS ACM Certificates may not yet have the info needed to validate it
   * - Specifically, the "ResourceRecord" object in the Domain Validation Options
   * - Ensure this exists.
   */
  const checkReadiness = async function () {
    if (readinessCheckCount < 1) {
      throw new Error(
        "Your newly created AWS ACM Certificate is taking a while to initialize.  Please try running this component again in a few minutes."
      );
    }

    const cert = await describeCertificateByArn(
      acm,
      certificate.CertificateArn
    );

    // Find root domain validation option resource record
    cert.DomainValidationOptions.forEach((option) => {
      if (domain === option.DomainName) {
        validationResourceRecord = option.ResourceRecord;
      }
    });

    if (!validationResourceRecord) {
      readinessCheckCount--;
      await utils.sleep(5000);
      return await checkReadiness();
    }
  };

  await checkReadiness();

  const checkRecordsParams = {
    HostedZoneId: domainHostedZoneId,
    MaxItems: "10",
    StartRecordName: validationResourceRecord.Name
  };

  // Check if the validation resource record sets already exist.
  // This might be the case if the user is trying to deploy multiple times while validation is occurring.
  const existingRecords = await route53
    .listResourceRecordSets(checkRecordsParams)
    .promise();

  if (!existingRecords.ResourceRecordSets.length) {
    // Create CNAME record for DNS validation check
    // NOTE: It can take 30 minutes or longer for DNS propagation so validation can complete, just continue on and don't wait for this...
    const recordParams = {
      HostedZoneId: domainHostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: validationResourceRecord.Name,
              Type: validationResourceRecord.Type,
              TTL: 300,
              ResourceRecords: [
                {
                  Value: validationResourceRecord.Value
                }
              ]
            }
          }
        ]
      }
    };
    await route53.changeResourceRecordSets(recordParams).promise();
  }

  /**
   * Check Validated Status
   * - Newly Validated AWS ACM Certificates may not yet show up as valid
   * - This gives them some time to update their status.
   */
  const checkStatus = async function () {
    if (statusCheckCount < 1) {
      throw new Error(
        "Your newly validated AWS ACM Certificate is taking a while to register as valid.  Please try running this component again in a few minutes."
      );
    }

    const cert = await describeCertificateByArn(
      acm,
      certificate.CertificateArn
    );

    if (cert.Status !== "ISSUED") {
      statusCheckCount--;
      await utils.sleep(10000);
      return await checkStatus();
    }
  };

  await checkStatus();
};

/**
 * Create AWS API Gateway Domain
 */
const createDomainInApig = async (apig, domain, certificateArn) => {
  try {
    const params = {
      domainName: domain,
      certificateArn: certificateArn,
      securityPolicy: "TLS_1_2",
      endpointConfiguration: {
        types: ["EDGE"]
      }
    };
    const res = await apig.createDomainName(params).promise();
    return res;
  } catch (e) {
    if (e.code === "TooManyRequestsException") {
      await utils.sleep(2000);
      return createDomainInApig(apig, domain, certificateArn);
    }
    throw e;
  }
};

/**
 * Configure DNS for the created API Gateway domain
 */
const configureDnsForApigDomain = async (
  route53,
  domain,
  hostedZoneId,
  distributionHostedZoneId,
  distributionDomainName
) => {
  const dnsRecord = {
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: domain,
            Type: "A",
            AliasTarget: {
              HostedZoneId: distributionHostedZoneId,
              DNSName: distributionDomainName,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  };

  return route53.changeResourceRecordSets(dnsRecord).promise();
};

/**
 * Map API Gateway API to the created API Gateway Domain
 */
const mapDomainToApi = async (apig, domain, apiId, stage) => {
  try {
    const params = {
      domainName: domain,
      restApiId: apiId,
      basePath: "(none)",
      stage
    };
    // todo what if it already exists but for a different apiId
    return apig.createBasePathMapping(params).promise();
  } catch (e) {
    if (e.code === "TooManyRequestsException") {
      await utils.sleep(2000);
      return mapDomainToApi(apig, domain, apiId, stage);
    }
    throw e;
  }
};

const deployApiDomain = async (
  apig,
  route53,
  subdomain,
  certificateArn,
  domainHostedZoneId,
  that
) => {
  try {
    that.context.debug(
      `Mapping domain ${subdomain.domain} to API ID ${subdomain.apiId}`
    );
    await mapDomainToApi(
      apig,
      subdomain.domain,
      subdomain.apiId,
      subdomain.stage
    );
  } catch (e) {
    if (e.message === "Invalid domain name identifier specified") {
      that.context.debug(
        `Domain ${subdomain.domain} not found in API Gateway. Creating...`
      );

      const res = await createDomainInApig(
        apig,
        subdomain.domain,
        certificateArn
      );

      that.context.debug(
        `Configuring DNS for API Gateway domain ${subdomain.domain}.`
      );

      await configureDnsForApigDomain(
        route53,
        subdomain.domain,
        domainHostedZoneId,
        res.distributionHostedZoneId,
        res.distributionDomainName
      );

      // retry domain deployment now that domain is created
      return deployApiDomain(
        apig,
        route53,
        subdomain,
        certificateArn,
        domainHostedZoneId,
        that
      );
    }

    if (e.message === "Base path already exists for this domain name") {
      that.context.debug(
        `Domain ${subdomain.domain} is already mapped to API ID ${subdomain.apiId}.`
      );
      return;
    }
    throw new Error(e);
  }
};

/**
 * Get CloudFront Distribution using a domain name
 */
const getCloudFrontDistributionByDomain = async (cf, domain) => {
  const listRes = await cf.listDistributions({}).promise();

  const distribution = listRes.DistributionList.Items.find((dist) =>
    dist.Aliases.Items.includes(domain)
  );

  if (distribution) {
    return {
      arn: distribution.ARN,
      id: distribution.Id,
      url: distribution.DomainName,
      origins: distribution.Origins.Items.map((origin) => origin.DomainName),
      errorPages:
        distribution.CustomErrorResponses.Quantity === 2 ? true : false
    };
  }

  return null;
};

/**
 * Configure DNS records for a distribution domain
 */
const configureDnsForCloudFrontDistribution = async (
  route53,
  subdomain,
  domainHostedZoneId,
  distributionUrl,
  domainType
) => {
  const dnsRecordParams = {
    HostedZoneId: domainHostedZoneId,
    ChangeBatch: {
      Changes: []
    }
  };

  // don't create www records for apex mode
  if (!subdomain.domain.startsWith("www.") || domainType !== "apex") {
    dnsRecordParams.ChangeBatch.Changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: subdomain.domain,
        Type: "A",
        AliasTarget: {
          HostedZoneId: HOSTED_ZONE_ID,
          DNSName: distributionUrl,
          EvaluateTargetHealth: false
        }
      }
    });
  }

  // don't create apex records for www mode
  if (subdomain.domain.startsWith("www.") && domainType !== "www") {
    dnsRecordParams.ChangeBatch.Changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: subdomain.domain.replace("www.", ""),
        Type: "A",
        AliasTarget: {
          HostedZoneId: HOSTED_ZONE_ID,
          DNSName: distributionUrl,
          EvaluateTargetHealth: false
        }
      }
    });
  }

  // TODO: clean up the other records when switching types
  // clean up any previously created www records for apex mode
  // if (subdomain.domain.startsWith("www.") && domainType === "apex") {
  //   dnsRecordParams.ChangeBatch.Changes.push({
  //     Action: "DELETE",
  //     ResourceRecordSet: {
  //       Name: subdomain.domain,
  //       Type: "A",
  //       AliasTarget: {
  //         HostedZoneId: HOSTED_ZONE_ID,
  //         DNSName: distributionUrl,
  //         EvaluateTargetHealth: false
  //       }
  //     }
  //   });
  // }

  // clean up any previously created apex records for www mode
  // if (subdomain.domain.startsWith("www.") && domainType === "www") {
  //   dnsRecordParams.ChangeBatch.Changes.push({
  //     Action: "DELETE",
  //     ResourceRecordSet: {
  //       Name: subdomain.domain.replace("www.", ""),
  //       Type: "A",
  //       AliasTarget: {
  //         HostedZoneId: HOSTED_ZONE_ID,
  //         DNSName: distributionUrl,
  //         EvaluateTargetHealth: false
  //       }
  //     }
  //   });
  // }

  return route53.changeResourceRecordSets(dnsRecordParams).promise();
};

const createCloudfrontDistributionForAppSync = async (
  cf,
  subdomain,
  certificateArn,
  { ViewerCertificate, ...distributionDefaults }
) => {
  const params = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      Aliases: {
        Quantity: 1,
        Items: [subdomain.domain]
      },
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: `app-sync-${subdomain.apiId}`,
            DomainName: subdomain.url,
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginKeepaliveTimeout: 5,
              OriginProtocolPolicy: "https-only",
              OriginReadTimeout: 30,
              OriginSslProtocols: {
                Items: ["SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2"],
                Quantity: 4
              }
            }
          }
        ]
      },
      OriginGroups: {
        Quantity: 0,
        Items: []
      },
      DefaultCacheBehavior: {
        TargetOriginId: `app-sync-${subdomain.apiId}`,
        ForwardedValues: {
          QueryString: false,
          Cookies: {
            Forward: "none"
          }
        },
        TrustedSigners: {
          Enabled: false,
          Quantity: 0,
          Items: []
        },
        ViewerProtocolPolicy: "redirect-to-https",
        MinTTL: 0,
        AllowedMethods: {
          Quantity: 7,
          Items: ["HEAD", "GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
        },
        SmoothStreaming: false,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        Compress: false,
        LambdaFunctionAssociations: {
          Quantity: 0,
          Items: []
        },
        FieldLevelEncryptionId: ""
      },
      CacheBehaviors: {
        Quantity: 0,
        Items: []
      },
      CustomErrorResponses: {
        Quantity: 0,
        Items: []
      },
      Comment: `app-sync-${subdomain.apiId}`,
      PriceClass: "PriceClass_All",
      Enabled: true,
      WebACLId: "",
      HttpVersion: "http2",
      IsIPV6Enabled: true,
      ...distributionDefaults,
      ViewerCertificate: {
        ACMCertificateArn: certificateArn,
        SSLSupportMethod: "sni-only",
        MinimumProtocolVersion: DEFAULT_MINIMUM_PROTOCOL_VERSION,
        Certificate: certificateArn,
        CertificateSource: "acm",
        ...ViewerCertificate
      }
    }
  };

  const res = await cf.createDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

/**
 * Create Cloudfront Distribution
 */
const createCloudfrontDistribution = async (
  cf,
  subdomain,
  certificateArn,
  { ViewerCertificate, ...distributionDefaults },
  domainType
) => {
  const params = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      Aliases: {
        Quantity: 1,
        Items: [subdomain.domain]
      },
      DefaultRootObject: "index.html",
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: `S3-${subdomain.s3BucketName}`,
            DomainName: `${subdomain.s3BucketName}.s3.amazonaws.com`,
            OriginPath: "",
            CustomHeaders: {
              Quantity: 0,
              Items: []
            },
            S3OriginConfig: {
              OriginAccessIdentity: ""
            }
          }
        ]
      },
      OriginGroups: {
        Quantity: 0,
        Items: []
      },
      DefaultCacheBehavior: {
        TargetOriginId: `S3-${subdomain.s3BucketName}`,
        ForwardedValues: {
          QueryString: false,
          Cookies: {
            Forward: "none"
          },
          Headers: {
            Quantity: 0,
            Items: []
          },
          QueryStringCacheKeys: {
            Quantity: 0,
            Items: []
          }
        },
        TrustedSigners: {
          Enabled: false,
          Quantity: 0,
          Items: []
        },
        ViewerProtocolPolicy: "redirect-to-https",
        MinTTL: 0,
        AllowedMethods: {
          Quantity: 2,
          Items: ["HEAD", "GET"],
          CachedMethods: {
            Quantity: 2,
            Items: ["HEAD", "GET"]
          }
        },
        SmoothStreaming: false,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        Compress: false,
        LambdaFunctionAssociations: {
          Quantity: 0,
          Items: []
        },
        FieldLevelEncryptionId: ""
      },
      CacheBehaviors: {
        Quantity: 0,
        Items: []
      },
      CustomErrorResponses: {
        Quantity: 2,
        Items: [
          {
            ErrorCode: 404,
            ErrorCachingMinTTL: 300,
            ResponseCode: "200",
            ResponsePagePath: "/index.html"
          },
          {
            ErrorCode: 403,
            ErrorCachingMinTTL: 300,
            ResponseCode: "200",
            ResponsePagePath: "/index.html"
          }
        ]
      },
      Comment: "",
      Logging: {
        Enabled: false,
        IncludeCookies: false,
        Bucket: "",
        Prefix: ""
      },
      PriceClass: "PriceClass_All",
      Enabled: true,
      Restrictions: {
        GeoRestriction: {
          RestrictionType: "none",
          Quantity: 0,
          Items: []
        }
      },
      WebACLId: "",
      HttpVersion: "http2",
      IsIPV6Enabled: true,
      ...distributionDefaults,
      ViewerCertificate: {
        ACMCertificateArn: certificateArn,
        SSLSupportMethod: "sni-only",
        MinimumProtocolVersion: DEFAULT_MINIMUM_PROTOCOL_VERSION,
        Certificate: certificateArn,
        CertificateSource: "acm",
        ...ViewerCertificate
      }
    }
  };

  if (subdomain.domain.startsWith("www.")) {
    if (domainType === "apex") {
      params.DistributionConfig.Aliases.Items = [
        `${subdomain.domain.replace("www.", "")}`
      ];
    } else if (domainType !== "www") {
      params.DistributionConfig.Aliases.Quantity = 2;
      params.DistributionConfig.Aliases.Items.push(
        `${subdomain.domain.replace("www.", "")}`
      );
    }
  }

  const res = await cf.createDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

const updateCloudfrontDistributionForAppSync = async (
  cf,
  subdomain,
  distributionId,
  { ...distributionDefaults }
) => {
  // Update logic is a bit weird...
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property

  // 1. we gotta get the config first...
  const params = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  // 2. then add this property
  params.IfMatch = params.ETag;

  // 3. then delete this property
  delete params.ETag;

  // 4. then set this property
  params.Id = distributionId;

  // 5. then make our changes
  params.DistributionConfig.Origins.Items = [
    {
      Id: `app-sync-${subdomain.apiId}`,
      DomainName: subdomain.url,
      OriginPath: "",
      CustomHeaders: {
        Quantity: 0,
        Items: []
      },
      CustomOriginConfig: {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginKeepaliveTimeout: 5,
        OriginProtocolPolicy: "https-only",
        OriginReadTimeout: 30,
        OriginSslProtocols: {
          Items: ["SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2"],
          Quantity: 4
        }
      }
    }
  ];

  params.DistributionConfig.DefaultCacheBehavior.TargetOriginId = `app-sync-${subdomain.apiId}`;

  params.DistributionConfig = {
    ...params.DistributionConfig,
    ...distributionDefaults
  };

  // 6. then finally update!
  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

/*
 * Updates a distribution's origins
 */
const updateCloudfrontDistribution = async (
  cf,
  subdomain,
  distributionId,
  distributionDefaults
) => {
  // Update logic is a bit weird...
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property

  // 1. we gotta get the config first...
  const params = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  // 2. then add this property
  params.IfMatch = params.ETag;

  // 3. then delete this property
  delete params.ETag;

  // 4. then set this property
  params.Id = distributionId;

  // 5. then make our changes
  // todo maybe we should add ALL error codes returned from CloudFront/S3?!
  params.DistributionConfig.CustomErrorResponses = {
    Quantity: 2,
    Items: [
      {
        ErrorCode: 404,
        ErrorCachingMinTTL: 300,
        ResponseCode: "200",
        ResponsePagePath: "/index.html"
      },
      {
        ErrorCode: 403,
        ErrorCachingMinTTL: 300,
        ResponseCode: "200",
        ResponsePagePath: "/index.html"
      }
    ]
  };
  params.DistributionConfig.Origins.Items = [
    {
      Id: `S3-${subdomain.s3BucketName}`,
      DomainName: `${subdomain.s3BucketName}.s3.amazonaws.com`,
      OriginPath: "",
      CustomHeaders: {
        Quantity: 0,
        Items: []
      },
      S3OriginConfig: {
        OriginAccessIdentity: ""
      }
    }
  ];

  params.DistributionConfig.DefaultCacheBehavior.TargetOriginId = `S3-${subdomain.s3BucketName}`;

  params.DistributionConfig = {
    ...params.DistributionConfig,
    ...distributionDefaults
  };

  // 6. then finally update!
  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

/**
 * Invalidate Cloudfront Distribution
 */
const invalidateCloudfrontDistribution = async (cf, distributionId) => {
  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: String(Date.now()),
      Paths: {
        Quantity: 1,
        Items: ["/*"]
      }
    }
  };
  await cf.createInvalidation(params).promise();
};

/**
 * Remove AWS S3 Website DNS Records
 */
const removeCloudFrontDomainDnsRecords = async (
  route53,
  domain,
  domainHostedZoneId,
  distributionUrl
) => {
  const params = {
    HostedZoneId: domainHostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: "DELETE",
          ResourceRecordSet: {
            Name: domain,
            Type: "A",
            AliasTarget: {
              HostedZoneId: HOSTED_ZONE_ID,
              DNSName: distributionUrl,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  };

  // TODO: should the CNAME records be removed too?

  try {
    await route53.changeResourceRecordSets(params).promise();
  } catch (e) {
    if (e.code !== "InvalidChangeBatch") {
      throw e;
    }
  }
};

/**
 * Remove API Gateway Domain
 */
const removeApiDomain = async (apig, domain) => {
  const params = {
    domainName: domain
  };

  return apig.deleteDomainName(params).promise();
};

/**
 * Remove API Gateway Domain DNS Records
 */
const removeApiDomainDnsRecords = async (
  route53,
  domain,
  domainHostedZoneId,
  distributionHostedZoneId,
  distributionDomainName
) => {
  const dnsRecord = {
    HostedZoneId: domainHostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: "DELETE",
          ResourceRecordSet: {
            Name: domain,
            Type: "A",
            AliasTarget: {
              HostedZoneId: distributionHostedZoneId,
              DNSName: distributionDomainName,
              EvaluateTargetHealth: false
            }
          }
        }
      ]
    }
  };

  return route53.changeResourceRecordSets(dnsRecord).promise();
};

/**
 * Fetch API Gateway Domain Information
 */
const getApiDomainName = async (apig, domain) => {
  try {
    return apig.getDomainName({ domainName: domain }).promise();
  } catch (e) {
    if (e.code === "NotFoundException:") {
      return null;
    }
  }
};

// const getCloudFrontDistributionByUrl = async (cf, distributionUrl) => {
//   const listRes = await cf.listDistributions({}).promise()

//   const distribution = listRes.DistributionList.Items.find(
//     (dist) => dist.DomainName === distributionUrl
//   )

//   if (distribution) {
//     return {
//       arn: distribution.ARN,
//       id: distribution.Id,
//       url: distribution.DomainName,
//       origins: distribution.Origins.Items.map((origin) => origin.DomainName),
//       errorPages: distribution.CustomErrorResponses.Quantity === 2 ? true : false
//     }
//   }

//   return null
// }

const addDomainToCloudfrontDistribution = async (
  cf,
  subdomain,
  certificateArn,
  { ViewerCertificate, ...distributionDefaults },
  domainType
) => {
  // Update logic is a bit weird...
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property

  // 1. we gotta get the config first...
  const params = await cf
    .getDistributionConfig({ Id: subdomain.distributionId })
    .promise();

  // 2. then add this property
  params.IfMatch = params.ETag;

  // 3. then delete this property
  delete params.ETag;

  // 4. then set this property
  params.Id = subdomain.distributionId;

  // 5. then make our changes
  params.DistributionConfig.Aliases = {
    Quantity: 1,
    Items: [subdomain.domain]
  };

  if (subdomain.domain.startsWith("www.")) {
    if (domainType === "apex") {
      params.DistributionConfig.Aliases.Items = [
        `${subdomain.domain.replace("www.", "")}`
      ];
    } else if (domainType !== "www") {
      params.DistributionConfig.Aliases.Quantity = 2;
      params.DistributionConfig.Aliases.Items.push(
        `${subdomain.domain.replace("www.", "")}`
      );
    }
  }

  params.DistributionConfig = {
    ...params.DistributionConfig,
    ...distributionDefaults
  };

  params.DistributionConfig.ViewerCertificate = {
    ACMCertificateArn: certificateArn,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: DEFAULT_MINIMUM_PROTOCOL_VERSION,
    Certificate: certificateArn,
    CertificateSource: "acm",
    ...ViewerCertificate
  };

  // 6. then finally update!
  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

const removeDomainFromCloudFrontDistribution = async (
  cf,
  subdomain,
  { ViewerCertificate = {} }
) => {
  const params = await cf
    .getDistributionConfig({ Id: subdomain.distributionId })
    .promise();

  params.IfMatch = params.ETag;

  delete params.ETag;

  params.Id = subdomain.distributionId;

  params.DistributionConfig.Aliases = {
    Quantity: 0,
    Items: []
  };

  params.DistributionConfig.ViewerCertificate = {
    SSLSupportMethod: ViewerCertificate.SSLSupportMethod || "sni-only",
    MinimumProtocolVersion:
      ViewerCertificate.MinimumProtocolVersion ||
      DEFAULT_MINIMUM_PROTOCOL_VERSION
  };

  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

module.exports = {
  getClients,
  prepareSubdomains,
  getOutdatedDomains,
  describeCertificateByArn,
  getCertificateArnByDomain,
  createCertificate,
  validateCertificate,
  getDomainHostedZoneId,
  createCloudfrontDistribution,
  updateCloudfrontDistribution,
  invalidateCloudfrontDistribution,
  mapDomainToApi,
  createDomainInApig,
  configureDnsForApigDomain,
  deployApiDomain,
  removeApiDomain,
  removeApiDomainDnsRecords,
  getCloudFrontDistributionByDomain,
  configureDnsForCloudFrontDistribution,
  getApiDomainName,
  removeCloudFrontDomainDnsRecords,
  addDomainToCloudfrontDistribution,
  removeDomainFromCloudFrontDistribution,
  createCloudfrontDistributionForAppSync,
  updateCloudfrontDistributionForAppSync
};
