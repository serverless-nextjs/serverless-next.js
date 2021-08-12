import AWS, { Credentials } from "aws-sdk";
import { isEmpty, Merge, mergeDeepRight, pick } from "ramda";
import {
  configureTags,
  createQueue,
  deleteQueue,
  getAccountId,
  getArn,
  getDefaults,
  getQueue,
  getUrl,
  setAttributes
} from "./utils";
import { Component } from "@serverless/core";

const outputsList = ["arn", "url"];

const defaults = {
  name: "serverless",
  region: "us-east-1",
  tags: undefined
};

class AwsSqsQueue extends Component {
  context: {
    credentials: {
      aws: Credentials;
    };
    instance: {
      debugMode: boolean;
    };
    status(status: string): void;
    debug(message: string): void;
  };
  state: {
    name?: string;
    region?: string;
    arn?: string;
    url?: string;
    tags?: { [key: string]: string };
  };
  save: () => void;
  init: () => void;

  async default(
    inputs = {
      name: undefined,
      region: undefined,
      arn: undefined,
      url: undefined,
      tags: undefined
    }
  ): Promise<
    Pick<
      Merge<
        {
          name: undefined;
          region: undefined;
          arn: undefined;
          url: undefined;
          tags: undefined;
        },
        Record<string, unknown>,
        "deep"
      >,
      "name" | "region" | "arn" | "url" | "tags"
    >
  > {
    const config = mergeDeepRight(getDefaults({ defaults }), inputs);
    const accountId = await getAccountId();

    if (AWS && AWS.config) {
      AWS.config.update({
        maxRetries: parseInt(process.env.SLS_NEXT_MAX_RETRIES || "10"),
        retryDelayOptions: { base: 200 }
      });
    }

    const arn = getArn({
      accountId,
      name: config.name,
      region: config.region
    });

    const queueUrl = getUrl({
      accountId,
      name: config.name,
      region: config.region
    });

    config.arn = arn;
    config.url = queueUrl;

    this.context.status(`Deploying`);

    const sqs = new AWS.SQS({
      region: config.region,
      credentials: this.context.credentials.aws
    });

    const prevInstance = await getQueue({
      sqs,
      queueUrl: this.state.url || queueUrl
    });

    if (isEmpty(prevInstance)) {
      this.context.status(`Creating`);
      await createQueue({
        sqs,
        config: config
      });
    } else {
      if (this.state.url === queueUrl) {
        this.context.status(`Updating`);
        await setAttributes(sqs, queueUrl, config);
      } else {
        if (this.state.url) {
          this.context.debug(`The QueueUrl has changed`);
          this.context.debug(`Deleting previous queue`);
          await deleteQueue({ sqs, queueUrl: this.state.url });
        }

        this.context.debug(`Creating new queue`);

        await createQueue({
          sqs,
          config: config
        });
      }
    }

    // Synchronize tags if specified
    if (config.tags) {
      this.context.debug(
        "Configuring SQS queue tags since they are specified."
      );
      await configureTags(this.context, sqs, queueUrl, config.tags);
    }

    this.state.name = config.name;
    this.state.arn = config.arn;
    this.state.url = config.url;
    this.state.region = config.region;
    this.state.tags = config.tags;
    await this.save();

    return pick(outputsList, config);
  }

  async addEventSource(functionArn: string): Promise<void> {
    const lambda = new AWS.Lambda({
      region: this.state.region,
      credentials: this.context.credentials.aws
    });

    const existing = await lambda
      .listEventSourceMappings({
        EventSourceArn: this.state.arn,
        FunctionName: functionArn
      })
      .promise();

    const mappings = existing.EventSourceMappings || [];

    if (mappings.length) {
      return;
    }

    await lambda
      .createEventSourceMapping({
        EventSourceArn: this.state.arn,
        FunctionName: functionArn
      })
      .promise();
  }

  async remove(
    inputs: { name: string } = {
      name: undefined
    }
  ): Promise<Record<string, never>> {
    const config = mergeDeepRight(defaults, inputs);
    config.name = inputs.name || this.state.name || defaults.name;

    const sqs = new AWS.SQS({
      region: config.region,
      credentials: this.context.credentials.aws
    });

    const accountId = await getAccountId();

    const queueUrl =
      this.state.url ||
      getUrl({
        accountId,
        name: config.name,
        region: config.region
      });

    this.context.status(`Removing`);

    await deleteQueue({ sqs, queueUrl });

    this.state = {};
    await this.save();

    return {};
  }
}

export default AwsSqsQueue;
