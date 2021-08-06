import { clone } from "ramda";
import AWS, { Credentials } from "aws-sdk";
import * as _ from "lodash";
import {
  CreateQueueRequest,
  CreateQueueResult,
  TagMap
} from "aws-sdk/clients/sqs";

const getDefaults = ({
  defaults
}: {
  defaults: Record<string, unknown>;
}): Record<string, unknown> => {
  return clone(defaults);
};

const getQueue = async ({
  sqs,
  queueUrl
}: {
  sqs: AWS.SQS;
  queueUrl: string;
}): Promise<Record<string, unknown>> => {
  let queueAttributes = {};
  try {
    const response = await sqs
      .getQueueAttributes({ QueueUrl: queueUrl })
      .promise();
    queueAttributes = response.Attributes;
  } catch (error) {
    if (error.code !== "AWS.SimpleQueueService.NonExistentQueue") {
      throw error;
    }
  }
  return queueAttributes;
};

const getAccountId = async (): Promise<string> => {
  const STS = new AWS.STS();
  const res = await STS.getCallerIdentity({}).promise();
  return res.Account;
};

const getUrl = ({
  name,
  region,
  accountId
}: {
  name: string;
  region: string;
  accountId: string;
}): string => {
  return `https://sqs.${region}.amazonaws.com/${accountId}/${name}`;
};

const getArn = ({
  name,
  region,
  accountId
}: {
  name: string;
  region: string;
  accountId: string;
}): string => {
  return `arn:aws:sqs:${region}:${accountId}:${name}`;
};

const createAttributeMap = (config): { [key: string]: string } => {
  const attributeMap: { [key: string]: string } = {};
  if (typeof config.visibilityTimeout !== "undefined")
    attributeMap.VisibilityTimeout = config.visibilityTimeout.toString();
  if (typeof config.maximumMessageSize !== "undefined")
    attributeMap.MaximumMessageSize = config.maximumMessageSize.toString();
  if (typeof config.messageRetentionPeriod !== "undefined")
    attributeMap.MessageRetentionPeriod =
      config.messageRetentionPeriod.toString();
  if (typeof config.delaySeconds !== "undefined")
    attributeMap.DelaySeconds = config.delaySeconds.toString();
  if (typeof config.receiveMessageWaitTimeSeconds !== "undefined")
    attributeMap.ReceiveMessageWaitTimeSeconds =
      config.receiveMessageWaitTimeSeconds.toString();
  if (typeof config.redrivePolicy !== "undefined")
    attributeMap.RedrivePolicy = JSON.stringify(config.redrivePolicy) || "";
  if (typeof config.policy !== "undefined")
    attributeMap.Policy = JSON.stringify(config.policy) || "";
  if (typeof config.kmsMasterKeyId !== "undefined")
    attributeMap.KmsMasterKeyId = JSON.stringify(config.kmsMasterKeyId) || "";
  if (typeof config.kmsDataKeyReusePeriodSeconds !== "undefined")
    attributeMap.KmsDataKeyReusePeriodSeconds =
      JSON.stringify(config.kmsDataKeyReusePeriodSeconds) || "300";

  if (config.fifoQueue) {
    if (typeof config.deduplicationScope !== "undefined") {
      attributeMap.DeduplicationScope = config.deduplicationScope.toString();
    }
    if (typeof config.fifoThroughputLimit !== "undefined") {
      attributeMap.FifoThroughputLimit = config.fifoThroughputLimit.toString();
    }
    if (typeof config.kmsDataKeyReusePeriodSeconds !== "undefined") {
      attributeMap.ContentBasedDeduplication =
        JSON.stringify(config.contentBasedDeduplication) || "false";
    }
  }

  return attributeMap;
};

const createQueue = async ({
  sqs,
  config
}: {
  sqs: AWS.SQS;
  config: Record<string, unknown>;
}): Promise<{
  url: string;
}> => {
  const params: CreateQueueRequest = {
    QueueName: config.name as string,
    Attributes: createAttributeMap(config),
    tags: undefined
  };

  if (config.fifoQueue) {
    params.Attributes.FifoQueue = "true";
  }

  if (config.tags) {
    params.tags = config.tags as TagMap;
  }
  const { QueueUrl: url }: CreateQueueResult = await sqs
    .createQueue(params)
    .promise();
  return { url };
};

const getAttributes = async (
  sqs: AWS.SQS,
  queueUrl: string
): Promise<Record<string, unknown>> => {
  const params = {
    QueueUrl: queueUrl,
    AttributeNames: ["All"]
  };
  const { Attributes: queueAttributes } = await sqs
    .getQueueAttributes(params)
    .promise();
  return queueAttributes;
};

const setAttributes = async (
  sqs: AWS.SQS,
  queueUrl: string,
  config: Record<string, unknown>
): Promise<void> => {
  const params = {
    QueueUrl: queueUrl,
    Attributes: createAttributeMap(config)
  };
  await sqs.setQueueAttributes(params).promise();
};

const configureTags = async (
  context: {
    credentials: {
      aws: Credentials;
    };
    instance: {
      debugMode: boolean;
    };
    status(status: string): void;
    debug(message: string): void;
  },
  sqs: AWS.SQS,
  queueUrl: string,
  inputTags: { [key: string]: string }
): Promise<void> => {
  const currentTags = {};

  context.debug("Trying to get existing tags.");
  const data = await sqs.listQueueTags({ QueueUrl: queueUrl }).promise();

  if (data.Tags) {
    Object.keys(data.Tags).forEach((key) => {
      currentTags[key] = data.Tags[key];
    });
  }

  // Sync tags if different from current tags
  if (!_.isEqual(inputTags, currentTags)) {
    context.debug("Tags have changed. Updating tags.");
    await sqs
      .untagQueue({
        QueueUrl: queueUrl,
        TagKeys: Object.keys(inputTags)
      })
      .promise();

    await sqs
      .tagQueue({
        QueueUrl: queueUrl,
        Tags: inputTags
      })
      .promise();
  } else {
    context.debug("Tags are the same as before, not doing anything.");
  }
};

const deleteQueue = async ({ sqs, queueUrl }): Promise<void> => {
  try {
    await sqs.deleteQueue({ QueueUrl: queueUrl }).promise();
  } catch (error) {
    if (error.code !== "AWS.SimpleQueueService.NonExistentQueue") {
      throw error;
    }
  }
};

export {
  createQueue,
  deleteQueue,
  getAccountId,
  getArn,
  getUrl,
  getDefaults,
  getQueue,
  getAttributes,
  setAttributes,
  configureTags
};
