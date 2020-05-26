import { Component } from "@serverless/core";
import AWS from "aws-sdk";

type NextjsComponentInput = {};

class NextjsComponent extends Component {
  async deploy(inputs: NextjsComponentInput): Promise<void> {
    const cloudFront = new AWS.CloudFront({
      credentials: this.credentials.aws
    });

    await cloudFront
      .createDistribution({
        DistributionConfig: {
          DefaultCacheBehavior: {
            MinTTL: 0,
            TTL: 0,
            MaxTTL: 0
          }
        }
      })
      .promise();
  }
}

export default NextjsComponent;
