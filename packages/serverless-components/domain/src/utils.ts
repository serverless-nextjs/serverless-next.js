import AWS from "aws-sdk";
import { utils } from "@serverless/core";

const HOSTED_ZONE_ID = "Z2FDTNDATAQYW2"; // this is a constant that you can get from here https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-aliastarget.html

/**
 * Get Clients
 * - Gets AWS SDK clients to use within this Component
 */
const getClients = (credentials, region = "us-east-1") => {
  if (AWS && AWS.config) {
    AWS.config.update({
      maxRetries: parseInt(process.env.SLS_NEXT_MAX_RETRIES || "10"),
      retryDelayOptions: { base: 200 }
    });
  }

  const route53 = new AWS.Route53({
    credentials,
    region
  });

  const acm = new AWS.ACM({
    credentials,
    region: "us-east-1" // ACM must be in us-east-1
  });

  const cf = new AWS.CloudFront({
    credentials,
    region
  });

  return {
    route53,
    acm,
    cf
  };
};

/**
 * Prepare Domains
 * - Formats component domains & identifies cloud services they're using.
 */
const prepareSubdomains = (inputs) => {
  const subdomains = [];

  for (const subdomain in inputs.subdomains || {}) {
    const domainObj: any = {};

    domainObj.domain = `${subdomain}.${inputs.domain}`;

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
      outdatedDomains.subdomains.push(domain);
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
  const params = {
    DNSName: domain
  };

  const hostedZonesRes = await route53.listHostedZonesByName(params).promise();

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
        const nakedDomain = domain.replace("www.", "");
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
 * Configure DNS records for a distribution domain
 */
const configureDnsForCloudFrontDistribution = (
  route53,
  subdomain,
  domainHostedZoneId,
  distributionUrl,
  domainType,
  context
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

  context.debug(
    "Updating Route53 DNS records with parameters:\n" +
      JSON.stringify(dnsRecordParams, null, 2)
  );

  return route53.changeResourceRecordSets(dnsRecordParams).promise();
};

/**
 * Remove AWS CloudFront Website DNS Records
 */
const removeCloudFrontDomainDnsRecords = async (
  route53,
  domain,
  domainHostedZoneId,
  distributionUrl,
  context
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
    context.debug(
      "Updating Route53 with parameters:\n" + JSON.stringify(params, null, 2)
    );

    await route53.changeResourceRecordSets(params).promise();
  } catch (e) {
    if (e.code !== "InvalidChangeBatch") {
      throw e;
    }
  }
};

const addDomainToCloudfrontDistribution = async (
  cf,
  subdomain,
  certificateArn,
  domainMinimumProtocolVersion,
  domainType,
  defaultCloudfrontInputs,
  context
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
    Items: [subdomain.domain]
  };

  if (subdomain.domain.startsWith("www.")) {
    if (domainType === "apex") {
      params.DistributionConfig.Aliases.Items = [
        `${subdomain.domain.replace("www.", "")}`
      ];
    } else if (domainType !== "www") {
      params.DistributionConfig.Aliases.Items.push(
        `${subdomain.domain.replace("www.", "")}`
      );
    }
  }

  // Update aliases quantity to reflect actual number of items
  params.DistributionConfig.Aliases.Quantity =
    params.DistributionConfig.Aliases.Items.length;

  params.DistributionConfig.ViewerCertificate = {
    ACMCertificateArn: certificateArn,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: domainMinimumProtocolVersion,
    Certificate: certificateArn,
    CertificateSource: "acm",
    ...defaultCloudfrontInputs.viewerCertificate
  };

  context.debug(
    "Updating CloudFront distribution with parameters:\n" +
      JSON.stringify(params, null, 2)
  );

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
  domainMinimumProtocolVersion,
  context
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
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: domainMinimumProtocolVersion
  };

  context.debug(
    "Updating CloudFront distribution with parameters:\n" +
      JSON.stringify(params, null, 2)
  );

  const res = await cf.updateDistribution(params).promise();

  return {
    id: res.Distribution.Id,
    arn: res.Distribution.ARN,
    url: res.Distribution.DomainName
  };
};

const isMinimumProtocolVersionValid = (minimumProtocolVersion) => {
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-distribution-viewercertificate.html
  const validMinimumProtocolVersions =
    /(^SSLv3$|^TLSv1$|^TLSv1.1_2016$|^TLSv1.2_2018$|^TLSv1.2_2019$|^TLSv1.2_2021$|^TLSv1_2016$)/g;
  return (
    minimumProtocolVersion.match(validMinimumProtocolVersions)?.length === 1
  );
};

export {
  getClients,
  prepareSubdomains,
  getOutdatedDomains,
  describeCertificateByArn,
  getCertificateArnByDomain,
  createCertificate,
  validateCertificate,
  getDomainHostedZoneId,
  configureDnsForCloudFrontDistribution,
  removeCloudFrontDomainDnsRecords,
  addDomainToCloudfrontDistribution,
  removeDomainFromCloudFrontDistribution,
  isMinimumProtocolVersionValid
};
