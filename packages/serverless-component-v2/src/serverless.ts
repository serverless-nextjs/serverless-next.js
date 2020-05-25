import { Component } from "@serverless/core";
import AWS from "aws-sdk";

class NextjsComponent extends Component {
  async deploy(inputs = {}) {
    const cloudFront = new AWS.CloudFront({
      credentials: this.credentials.aws
    });

    await cloudFront
      .createDistribution({
        DistributionConfig: {
          DefaultCacheBehavior: {}
        }
      })
      .promise();

    return {};
  }
}

export default NextjsComponent;
