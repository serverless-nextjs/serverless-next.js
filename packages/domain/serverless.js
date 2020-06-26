const { Component } = require("@serverless/core");
const {
  getClients,
  prepareSubdomains,
  getDomainHostedZoneId,
  describeCertificateByArn,
  getCertificateArnByDomain,
  createCertificate,
  validateCertificate,
  createCloudfrontDistribution,
  updateCloudfrontDistribution,
  getCloudFrontDistributionByDomain,
  invalidateCloudfrontDistribution,
  deployApiDomain,
  removeApiDomain,
  removeApiDomainDnsRecords,
  configureDnsForCloudFrontDistribution,
  getApiDomainName,
  removeCloudFrontDomainDnsRecords,
  addDomainToCloudfrontDistribution,
  removeDomainFromCloudFrontDistribution,
  createCloudfrontDistributionForAppSync,
  updateCloudfrontDistributionForAppSync
} = require("./utils");

class Domain extends Component {
  async default(inputs = {}) {
    this.context.status("Deploying");

    this.context.debug = inputs.verbose ? console.log : this.context.debug;

    this.context.debug(`Starting Domain component deployment.`);

    this.context.debug(`Validating inputs.`);

    inputs.region = inputs.region || "us-east-1";
    inputs.privateZone = inputs.privateZone || false;
    inputs.distributionDefaults = inputs.distributionDefaults || {};
    inputs.domainType = inputs.domainType || "both";

    if (!inputs.domain) {
      throw Error(`"domain" is a required input.`);
    }

    // TODO: Check if domain has changed.
    // On domain change, call remove for all previous state.

    // Get AWS SDK Clients
    const clients = getClients(this.context.credentials.aws, inputs.region);

    this.context.debug(
      `Formatting domains and identifying cloud services being used.`
    );
    const subdomains = prepareSubdomains(inputs);
    this.state.region = inputs.region;
    this.state.privateZone = JSON.parse(inputs.privateZone);
    this.state.domain = inputs.domain;
    this.state.subdomains = subdomains;
    this.state.distributionDefaults = inputs.distributionDefaults;

    await this.save();

    this.context.debug(
      `Getting the Hosted Zone ID for the domain ${inputs.domain}.`
    );
    const domainHostedZoneId = await getDomainHostedZoneId(
      clients.route53,
      inputs.domain,
      inputs.privateZone
    );

    this.context.debug(
      `Searching for an AWS ACM Certificate based on the domain: ${inputs.domain}.`
    );
    let certificateArn = await getCertificateArnByDomain(
      clients.acm,
      inputs.domain
    );
    if (!certificateArn) {
      this.context.debug(
        `No existing AWS ACM Certificates found for the domain: ${inputs.domain}.`
      );
      this.context.debug(
        `Creating a new AWS ACM Certificate for the domain: ${inputs.domain}.`
      );
      certificateArn = await createCertificate(clients.acm, inputs.domain);
    }

    this.context.debug(`Checking the status of AWS ACM Certificate.`);
    const certificate = await describeCertificateByArn(
      clients.acm,
      certificateArn
    );

    if (certificate.Status === "PENDING_VALIDATION") {
      this.context.debug(
        `AWS ACM Certificate Validation Status is "PENDING_VALIDATION".`
      );
      this.context.debug(
        `Validating AWS ACM Certificate via Route53 "DNS" method.`
      );
      await validateCertificate(
        clients.acm,
        clients.route53,
        certificate,
        inputs.domain,
        domainHostedZoneId
      );
      this.context.log(
        "Your AWS ACM Certificate has been created and is being validated via DNS.  This could take up to 30 minutes since it depends on DNS propagation. Continuing deployment, but you may have to wait for DNS propagation."
      );
    }

    if (
      certificate.Status !== "ISSUED" &&
      certificate.Status !== "PENDING_VALIDATION"
    ) {
      // TODO: Should we auto-create a new one in this scenario?
      throw new Error(
        `Your AWS ACM Certificate for the domain "${inputs.domain}" has an unsupported status of: "${certificate.Status}".  Please remove it manually and deploy again.`
      );
    }

    // Setting up domains for different services
    for (const subdomain of subdomains) {
      if (subdomain.type === "awsS3Website") {
        this.context.debug(
          `Configuring domain "${subdomain.domain}" for S3 Bucket Website`
        );

        this.context.debug(
          `Checking CloudFront distribution for domain "${subdomain.domain}"`
        );
        let distribution = await getCloudFrontDistributionByDomain(
          clients.cf,
          subdomain.domain
        );
        if (!distribution) {
          this.context.debug(
            `CloudFront distribution for domain "${subdomain.domain}" not found. Creating...`
          );
          distribution = await createCloudfrontDistribution(
            clients.cf,
            subdomain,
            certificate.CertificateArn,
            inputs.distributionDefaults,
            inputs.domainType
          );
        } else if (
          !distribution.origins.includes(
            `${subdomain.s3BucketName}.s3.amazonaws.com`
          ) ||
          !distribution.errorPages
        ) {
          this.context.debug(`Updating distribution "${distribution.url}".`);
          distribution = await updateCloudfrontDistribution(
            clients.cf,
            subdomain,
            distribution.id,
            inputs.distributionDefaults
          );
        }

        this.context.debug(
          `Configuring DNS for distribution "${distribution.url}".`
        );

        await configureDnsForCloudFrontDistribution(
          clients.route53,
          subdomain,
          domainHostedZoneId,
          distribution.url,
          inputs.domainType
        );

        this.context.debug(
          `Invalidating CloudFront distribution ${distribution.url}`
        );

        await invalidateCloudfrontDistribution(clients.cf, distribution.id);

        this.context.debug(
          `Using AWS Cloudfront Distribution with URL: "${subdomain.domain}"`
        );
      } else if (subdomain.type === "awsApiGateway") {
        // Map APIG domain to API ID and recursively retry
        // if APIG domain need to be created first, or TooManyRequests error is thrown
        await deployApiDomain(
          clients.apig,
          clients.route53,
          subdomain,
          certificate.CertificateArn,
          domainHostedZoneId,
          this // passing instance for helpful logs during the process
        );
      } else if (subdomain.type === "awsCloudFront") {
        this.context.debug(
          `Adding ${subdomain.domain} domain to CloudFront distribution with URL "${subdomain.url}"`
        );
        await addDomainToCloudfrontDistribution(
          clients.cf,
          subdomain,
          certificate.CertificateArn,
          inputs.distributionDefaults,
          inputs.domainType
        );

        this.context.debug(
          `Configuring DNS for distribution "${subdomain.url}".`
        );
        await configureDnsForCloudFrontDistribution(
          clients.route53,
          subdomain,
          domainHostedZoneId,
          subdomain.url.replace("https://", ""),
          inputs.domainType
        );
      } else if (subdomain.type === "awsAppSync") {
        this.context.debug(
          `Configuring domain "${subdomain.domain}" for AppSync API`
        );

        this.context.debug(
          `Checking CloudFront distribution for domain "${subdomain.domain}"`
        );
        let distribution = await getCloudFrontDistributionByDomain(
          clients.cf,
          subdomain.domain
        );
        if (!distribution) {
          this.context.debug(
            `CloudFront distribution for domain "${subdomain.domain}" not found. Creating...`
          );
          distribution = await createCloudfrontDistributionForAppSync(
            clients.cf,
            subdomain,
            certificate.CertificateArn,
            inputs.distributionDefaults
          );
        } else if (!distribution.origins.includes(subdomain.url)) {
          this.context.debug(`Updating distribution "${distribution.url}".`);
          distribution = await updateCloudfrontDistributionForAppSync(
            clients.cf,
            subdomain,
            distribution.id,
            inputs.distributionDefaults
          );
        }

        this.context.debug(
          `Configuring DNS for distribution "${distribution.url}".`
        );

        await configureDnsForCloudFrontDistribution(
          clients.route53,
          subdomain,
          domainHostedZoneId,
          distribution.url,
          inputs.domainType
        );

        this.context.debug(
          `Invalidating CloudFront distribution ${distribution.url}`
        );

        await invalidateCloudfrontDistribution(clients.cf, distribution.id);

        this.context.debug(
          `Using AWS Cloudfront Distribution with URL: "${subdomain.domain}"`
        );
      }

      // TODO: Remove unused domains that are kept in state
    }

    const outputs = {};
    let hasRoot = false;
    outputs.domains = subdomains.map((subdomain) => {
      if (subdomain.domain.startsWith("www")) {
        hasRoot = true;
      }
      return `https://${subdomain.domain}`;
    });

    if (hasRoot && inputs.domainType !== "www") {
      outputs.domains.unshift(`https://${inputs.domain.replace("www.", "")}`);
    }

    return outputs;
  }

  async remove() {
    this.context.status("Deploying");

    if (!this.state.domain) {
      return;
    }

    this.context.debug(`Starting Domain component removal.`);

    // Get AWS SDK Clients
    const clients = getClients(this.context.credentials.aws, this.state.region);

    this.context.debug(
      `Getting the Hosted Zone ID for the domain ${this.state.domain}.`
    );
    const domainHostedZoneId = await getDomainHostedZoneId(
      clients.route53,
      this.state.domain,
      this.state.privateZone
    );

    for (const subdomain in this.state.subdomains) {
      const domainState = this.state.subdomains[subdomain];
      if (domainState.type === "awsS3Website") {
        this.context.debug(
          `Fetching CloudFront distribution info for removal for domain ${domainState.domain}.`
        );
        const distribution = await getCloudFrontDistributionByDomain(
          clients.cf,
          domainState.domain
        );

        if (distribution) {
          this.context.debug(
            `Removing DNS records for website domain ${domainState.domain}.`
          );
          await removeCloudFrontDomainDnsRecords(
            clients.route53,
            domainState.domain,
            domainHostedZoneId,
            distribution.url
          );

          if (domainState.domain.startsWith("www")) {
            await removeCloudFrontDomainDnsRecords(
              clients.route53,
              domainState.domain.replace("www.", ""), // it'll move on if it doesn't exist
              domainHostedZoneId,
              distribution.url
            );
          }
        }
      } else if (domainState.type === "awsApiGateway") {
        this.context.debug(
          `Fetching API Gateway domain ${domainState.domain} information for removal.`
        );
        const domainRes = await getApiDomainName(
          clients.apig,
          domainState.domain
        );

        if (domainRes) {
          this.context.debug(
            `Removing API Gateway domain ${domainState.domain}.`
          );
          await removeApiDomain(clients.apig, domainState.domain);

          this.context.debug(
            `Removing DNS records for API Gateway domain ${domainState.domain}.`
          );
          await removeApiDomainDnsRecords(
            clients.route53,
            domainState.domain,
            domainHostedZoneId,
            domainRes.distributionHostedZoneId,
            domainRes.distributionDomainName
          );
        }
      } else if (domainState.type === "awsCloudFront") {
        this.context.debug(
          `Removing domain ${domainState.domain} from CloudFront.`
        );
        await removeDomainFromCloudFrontDistribution(
          clients.cf,
          domainState,
          this.state.distributionDefaults
        );

        this.context.debug(
          `Removing CloudFront DNS records for domain ${domainState.domain}`
        );
        await removeCloudFrontDomainDnsRecords(
          clients.route53,
          domainState.domain,
          domainHostedZoneId,
          domainState.url.replace("https://", "")
        );
      } else if (domainState.type === "awsAppSync") {
        const distribution = await getCloudFrontDistributionByDomain(
          clients.cf,
          domainState.domain
        );

        if (distribution) {
          this.context.debug(
            `Removing DNS records for AppSync domain ${domainState.domain}.`
          );
          await removeCloudFrontDomainDnsRecords(
            clients.route53,
            domainState.domain,
            domainHostedZoneId,
            distribution.url
          );
        }
      }
    }
    this.state = {};
    await this.save();
    return {};
  }
}

module.exports = Domain;
