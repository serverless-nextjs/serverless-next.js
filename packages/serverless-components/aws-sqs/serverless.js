const aws = require("aws-sdk");
const { isEmpty, mergeDeepRight, pick } = require("ramda");
const { Component } = require("@serverless/core");
const {
  createQueue,
  deleteQueue,
  getDefaults,
  getQueue,
  getAccountId,
  getArn,
  getUrl,
  setAttributes
} = require("./utils");

const outputsList = ["arn", "url"];

const defaults = {
  name: "serverless",
  region: "us-east-1"
};

class AwsSqsQueue extends Component {
  async default(inputs = {}) {
    const config = mergeDeepRight(getDefaults({ defaults }), inputs);
    const accountId = await getAccountId(aws);

    const arn = getArn({
      aws,
      accountId,
      name: config.name,
      region: config.region
    });

    const queueUrl = getUrl({
      aws,
      accountId,
      name: config.name,
      region: config.region
    });

    config.arn = arn;
    config.url = queueUrl;

    this.context.status(`Deploying`);

    const sqs = new aws.SQS({
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
        this.context.debug(`The QueueUrl has changed`);
        this.context.debug(`Deleting previous queue`);

        await deleteQueue({ sqs, queueUrl: this.state.url });

        this.context.debug(`Creating new queue`);

        await createQueue({
          sqs,
          config: config
        });
      }
    }

    this.state.name = config.name;
    this.state.arn = config.arn;
    this.state.url = config.url;
    this.state.region = config.region;
    await this.save();

    const outputs = pick(outputsList, config);
    return outputs;
  }

  async addEventSource(functionArn) {
    const lambda = new aws.Lambda({
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

  async remove(inputs = {}) {
    const config = mergeDeepRight(defaults, inputs);
    config.name = inputs.name || this.state.name || defaults.name;

    const sqs = new aws.SQS({
      region: config.region,
      credentials: this.context.credentials.aws
    });

    const accountId = await getAccountId(aws);

    const queueUrl =
      this.state.url ||
      getUrl({
        aws,
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

module.exports = AwsSqsQueue;
