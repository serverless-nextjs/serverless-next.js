import { Component } from "@serverless/core";
import {
  getClients,
  prepareSubdomains,
  getDomainHostedZoneId,
  describeCertificateByArn,
  getCertificateArnByDomain,
  createCertificate,
  validateCertificate,
  configureDnsForCloudFrontDistribution,
  removeCloudFrontDomainDnsRecords,
  addDomainToCloudfrontDistribution,
  removeDomainFromCloudFrontDistribution,
  isMinimumProtocolVersionValid
} from "./utils";

export default class Domain extends Component {
  async default(inputs: any = {}) {
    this.context.status("Deploying");

    this.context.debug("Starting Domain component deployment.");

    this.context.debug("Validating inputs.");

    inputs.region = inputs.region || "us-east-1";
    inputs.privateZone = inputs.privateZone || false;
    inputs.domainType = inputs.domainType || "both";
    inputs.defaultCloudfrontInputs = inputs.defaultCloudfrontInputs || {};
    inputs.certificateArn = inputs.certificateArn || "";
    inputs.domainMinimumProtocolVersion =
      inputs.domainMinimumProtocolVersion || "TLSv1.2_2018";

    if (!inputs.domain) {
      throw Error('"domain" is a required input.');
    }

    if (!isMinimumProtocolVersionValid(inputs.domainMinimumProtocolVersion)) {
      throw Error('"minimumProtocolVersion" has invalid value.');
    }

    // TODO: Check if domain has changed.
    // On domain change, call remove for all previous state.

    // Get AWS SDK Clients
    const clients = getClients(this.context.credentials.aws, inputs.region);

    this.context.debug(
      "Formatting domains and identifying cloud services being used."
    );
    const subdomains = prepareSubdomains(inputs);
    this.state.region = inputs.region;
    this.state.privateZone = JSON.parse(inputs.privateZone);
    this.state.domain = inputs.domain;
    this.state.subdomains = subdomains;
    this.state.domainMinimumProtocolVersion =
      inputs.domainMinimumProtocolVersion;

    await this.save();

    this.context.debug(
      `Getting the Hosted Zone ID for the domain ${inputs.domain}.`
    );
    const domainHostedZoneId = await getDomainHostedZoneId(
      clients.route53,
      inputs.domain,
      inputs.privateZone
    );

    let certificateArn = "";
    if (inputs.certificateArn === "") {
      this.context.debug(
        `Searching for an AWS ACM Certificate based on the domain: ${inputs.domain}.`
      );
      certificateArn = await getCertificateArnByDomain(
        clients.acm,
        inputs.domain
      );
    } else {
      this.context.debug(
        `Using specified SSL Certificate ARN: ${inputs.certificateArn}.`
      );
      certificateArn = inputs.certificateArn;
    }

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
        'AWS ACM Certificate Validation Status is "PENDING_VALIDATION".'
      );
      this.context.debug(
        'Validating AWS ACM Certificate via Route53 "DNS" method.'
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
        throw new Error("Unsupported subdomain type awsS3Website");
      } else if (subdomain.type === "awsApiGateway") {
        throw new Error("Unsupported subdomain type awsApiGateway");
      } else if (subdomain.type === "awsCloudFront") {
        this.context.debug(
          `Adding ${subdomain.domain} domain to CloudFront distribution with URL "${subdomain.url}.\nTLS minimum protocol version: ${inputs.domainMinimumProtocolVersion}`
        );
        await addDomainToCloudfrontDistribution(
          clients.cf,
          subdomain,
          certificate.CertificateArn,
          inputs.domainMinimumProtocolVersion,
          inputs.domainType,
          inputs.defaultCloudfrontInputs,
          this.context
        );

        this.context.debug(
          `Configuring DNS for distribution "${subdomain.url}".`
        );
        if (domainHostedZoneId) {
          await configureDnsForCloudFrontDistribution(
            clients.route53,
            subdomain,
            domainHostedZoneId,
            subdomain.url.replace("https://", ""),
            inputs.domainType,
            this.context
          );
        } else {
          this.context.debug(
            `DNS records for domain ${subdomain.domain} were not configured because the domain was not found in your account. Please configure the DNS records manually`
          );
        }
      } else if (subdomain.type === "awsAppSync") {
        throw new Error("Unsupported subdomain type awsAppSync");
      }
    }

    const outputs: any = {};
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

    this.context.debug("Starting Domain component removal.");

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
        this.context.debug("Unsupported subdomain type awsS3Website");
      } else if (domainState.type === "awsApiGateway") {
        this.context.debug("Unsupported subdomain type awsApiGateway");
      } else if (domainState.type === "awsCloudFront") {
        this.context.debug(
          `Removing domain ${domainState.domain} from CloudFront.`
        );
        await removeDomainFromCloudFrontDistribution(
          clients.cf,
          domainState,
          this.state.domainMinimumProtocolVersion,
          this.context
        );

        if (domainHostedZoneId) {
          this.context.debug(
            `Removing CloudFront DNS records for domain ${domainState.domain}`
          );
          await removeCloudFrontDomainDnsRecords(
            clients.route53,
            domainState.domain,
            domainHostedZoneId,
            domainState.url.replace("https://", ""),
            this.context
          );
        } else {
          this.context.debug(
            `Could not remove the DNS records for domain ${domainState.domain} because the domain was not found in your account. Please remove the DNS records manually`
          );
        }
      } else if (domainState.type === "awsAppSync") {
        this.context.debug("Unsupported subdomain type awsAppSync");
      }
    }
    this.state = {};
    await this.save();
    return {};
  }
}
