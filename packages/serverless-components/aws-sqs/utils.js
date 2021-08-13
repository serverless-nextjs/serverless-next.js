const { clone } = require("ramda");
const _ = require("lodash");

const getDefaults = ({ defaults }) => {
  const response = clone(defaults);
  return response;
};

const getQueue = async ({ sqs, queueUrl }) => {
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

const getAccountId = async (aws) => {
  const STS = new aws.STS();
  const res = await STS.getCallerIdentity({}).promise();
  return res.Account;
};

const getUrl = ({ name, region, accountId }) => {
  return `https://sqs.${region}.amazonaws.com/${accountId}/${name}`;
};

const getArn = ({ name, region, accountId }) => {
  return `arn:aws:sqs:${region}:${accountId}:${name}`;
};

const createAttributeMap = (config) => {
  const attributeMap = {};
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

const createQueue = async ({ sqs, config }) => {
  const params = {
    QueueName: config.name,
    Attributes: createAttributeMap(config)
  };

  if (config.fifoQueue) {
    params.Attributes.FifoQueue = "true";
  }

  if (config.tags) {
    params.tags = config.tags;
  }
  const { QueueArn: arn } = await sqs.createQueue(params).promise();
  return { arn };
};

const getAttributes = async (sqs, queueUrl) => {
  const params = {
    QueueUrl: queueUrl,
    AttributeNames: ["All"]
  };
  const { Attributes: queueAttributes } = await sqs
    .getQueueAttributes(params)
    .promise();
  return queueAttributes;
};

const setAttributes = async (sqs, queueUrl, config) => {
  const params = {
    QueueUrl: queueUrl,
    Attributes: createAttributeMap(config)
  };
  await sqs.setQueueAttributes(params).promise();
};

const deleteQueue = async ({ sqs, queueUrl }) => {
  try {
    await sqs.deleteQueue({ QueueUrl: queueUrl }).promise();
  } catch (error) {
    if (error.code !== "AWS.SimpleQueueService.NonExistentQueue") {
      throw error;
    }
  }
};

const configureTags = async (context, sqs, queueUrl, inputTags) => {
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

module.exports = {
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
