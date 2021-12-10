import AWS from "aws-sdk";
import { equals } from "ramda";
import { Component } from "@serverless/core";
import {
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution,
  setCloudFrontDistributionTags
} from "./";

/*
 * Website
 */

class CloudFront extends Component {
  context: any;
  state: any;
  save: () => void;
  /*
   * Default
   */

  async default(inputs: any = {}) {
    this.context.status("Deploying");

    inputs.region = inputs.region ?? "us-east-1";
    inputs.bucketRegion = inputs.bucketRegion ?? "us-east-1"; // S3 client needs to be specific to the bucket region
    inputs.enabled = inputs.enabled !== false;
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

    if (AWS?.config) {
      AWS.config.update({
        maxRetries: parseInt(process.env.SLS_NEXT_MAX_RETRIES ?? "10"),
        retryDelayOptions: { base: 200 }
      });
    }

    const cf = new AWS.CloudFront({
      credentials: this.context.credentials.aws,
      region: inputs.region
    });

    const s3 = new AWS.S3({
      credentials: this.context.credentials.aws,
      region: inputs.bucketRegion
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
        ) ||
        !equals(this.state.tags, inputs.tags)
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

      // Set distribution tags separately after updating distribution
      if (inputs.tags && !equals(this.state.tags, inputs.tags)) {
        this.context.debug(
          `Updating tags for CloudFront distribution of ID ${this.state.id}.`
        );
        await setCloudFrontDistributionTags(cf, this.state.arn, inputs.tags);
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
    this.state.tags = inputs.tags;
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

    const cf = new AWS.CloudFront({
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

export default CloudFront;
