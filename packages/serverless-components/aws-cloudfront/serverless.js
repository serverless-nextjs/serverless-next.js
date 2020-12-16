const aws = require("aws-sdk");
const { equals } = require("ramda");
const { Component } = require("@serverless/core");
const {
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution
} = require("./lib");

/*
 * Website
 */

class CloudFront extends Component {
  /*
   * Default
   */

  async default(inputs = {}) {
    this.context.status("Deploying");

    inputs.region = inputs.region || "us-east-1";
    inputs.enabled = inputs.enabled === false ? false : true;
    inputs.comment =
      inputs.comment === null || inputs.comment === undefined
        ? ""
        : String(inputs.comment);
    inputs.aliases = inputs.aliases || undefined; // by default will be undefined, not empty array
    inputs.priceClass = [
      "PriceClass_All",
      "PriceClass_200",
      "PriceClass_100"
    ].includes(inputs.priceClass)
      ? inputs.priceClass
      : "PriceClass_All";
    inputs.errorPages = inputs.errorPages || [];

    this.context.debug(
      `Starting deployment of CloudFront distribution to the ${inputs.region} region.`
    );

    const cf = new aws.CloudFront({
      credentials: this.context.credentials.aws,
      region: inputs.region
    });

    const s3 = new aws.S3({
      credentials: this.context.credentials.aws,
      region: inputs.region
    });

    this.state.id = inputs.distributionId || this.state.id;

    if (this.state.id) {
      if (
        !equals(this.state.origins, inputs.origins) ||
        !equals(this.state.defaults, inputs.defaults) ||
        !equals(this.state.enabled, inputs.enabled) ||
        !equals(this.state.comment, inputs.comment) ||
        !equals(this.state.aliases, inputs.aliases) ||
        !equals(this.state.priceClass, inputs.priceClass) ||
        !equals(this.state.errorPages, inputs.errorPages) ||
        !equals(this.state.webACLId, inputs.webACLId) ||
        !equals(this.state.restrictions, inputs.restrictions) ||
        !equals(this.state.certificate, inputs.certificate) ||
        !equals(
          this.state.originAccessIdentityId,
          inputs.originAccessIdentityId
        )
      ) {
        this.context.debug(
          `Updating CloudFront distribution of ID ${this.state.id}.`
        );
        this.state = await updateCloudFrontDistribution(
          cf,
          s3,
          this.state.id,
          inputs
        );
      }
    } else {
      this.context.debug(
        `Creating CloudFront distribution in the ${inputs.region} region.`
      );
      this.state = await createCloudFrontDistribution(cf, s3, inputs);
    }

    this.state.region = inputs.region;
    this.state.enabled = inputs.enabled;
    this.state.comment = inputs.comment;
    this.state.aliases = inputs.aliases;
    this.state.priceClass = inputs.priceClass;
    this.state.origins = inputs.origins;
    this.state.errorPages = inputs.errorPages;
    this.state.defaults = inputs.defaults;
    await this.save();

    this.context.debug(
      `CloudFront deployed successfully with URL: ${this.state.url}.`
    );

    return this.state;
  }

  /**
   * Remove
   */

  async remove() {
    this.context.status(`Removing`);

    if (!this.state.id) {
      return;
    }

    const cf = new aws.CloudFront({
      credentials: this.context.credentials.aws,
      region: this.state.region
    });

    await deleteCloudFrontDistribution(cf, this.state.id);

    this.state = {};
    await this.save();

    this.context.debug(`CloudFront distribution was successfully removed.`);
    return {};
  }
}

module.exports = CloudFront;
