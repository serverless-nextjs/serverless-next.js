const path = require("path");
const aws = require("aws-sdk");
const AwsSdkLambda = aws.Lambda;
const { mergeDeepRight, pick } = require("ramda");
const { Component, utils } = require("@serverless/core");
const {
  createLambda,
  updateLambdaCode,
  updateLambdaConfig,
  getLambda,
  deleteLambda,
  configChanged,
  pack
} = require("./utils");

const outputsList = [
  "name",
  "hash",
  "description",
  "memory",
  "timeout",
  "code",
  "bucket",
  "shims",
  "handler",
  "runtime",
  "env",
  "role",
  "layer",
  "arn",
  "region"
];

const defaults = {
  description: "AWS Lambda Component",
  memory: 512,
  timeout: 10,
  code: process.cwd(),
  bucket: undefined,
  shims: [],
  handler: "handler.hello",
  runtime: "nodejs10.x",
  env: {},
  region: "us-east-1"
};

class AwsLambda extends Component {
  async default(inputs = {}) {
    this.context.status(`Deploying`);

    const config = mergeDeepRight(defaults, inputs);

    config.name = inputs.name || this.state.name || this.context.resourceId();

    this.context.debug(
      `Starting deployment of lambda ${config.name} to the ${config.region} region.`
    );

    const lambda = new AwsSdkLambda({
      region: config.region,
      credentials: this.context.credentials.aws
    });

    const awsIamRole = await this.load("@serverless/aws-iam-role");

    // If no role exists, create a default role
    let outputsAwsIamRole;
    if (!config.role) {
      this.context.debug(`No role provided for lambda ${config.name}.`);

      outputsAwsIamRole = await awsIamRole({
        service: "lambda.amazonaws.com",
        name: config.name,
        policy: {
          arn: "arn:aws:iam::aws:policy/AdministratorAccess"
        },
        region: config.region
      });
      config.role = { arn: outputsAwsIamRole.arn };
    } else {
      outputsAwsIamRole = await awsIamRole(config.role);
      config.role = { arn: outputsAwsIamRole.arn };
    }

    if (
      config.bucket &&
      config.runtime === "nodejs10.x" &&
      (await utils.dirExists(path.join(config.code, "node_modules")))
    ) {
      this.context.debug(
        `Bucket ${config.bucket} is provided for lambda ${config.name}.`
      );

      const layer = await this.load("@serverless/aws-lambda-layer");

      const layerInputs = {
        description: `${config.name} Dependencies Layer`,
        code: path.join(config.code, "node_modules"),
        runtimes: ["nodejs10.x"],
        prefix: "nodejs/node_modules",
        bucket: config.bucket,
        region: config.region
      };

      this.context.status("Deploying Dependencies");
      this.context.debug(`Packaging lambda code from ${config.code}.`);
      this.context.debug(
        `Uploading dependencies as a layer for lambda ${config.name}.`
      );

      const promises = [
        pack(config.code, config.shims, false),
        layer(layerInputs)
      ];
      const res = await Promise.all(promises);
      config.zipPath = res[0];
      config.layer = res[1];
    } else {
      this.context.status("Packaging");
      this.context.debug(`Packaging lambda code from ${config.code}.`);
      config.zipPath = await pack(config.code, config.shims);
    }

    config.hash = await utils.hashFile(config.zipPath);

    let deploymentBucket;
    if (config.bucket) {
      deploymentBucket = await this.load("@serverless/aws-s3");
    }

    const prevLambda = await getLambda({ lambda, ...config });

    if (!prevLambda) {
      if (config.bucket) {
        this.context.debug(
          `Uploading ${config.name} lambda package to bucket ${config.bucket}.`
        );
        this.context.status(`Uploading`);

        await deploymentBucket.upload({
          name: config.bucket,
          file: config.zipPath
        });
      }

      this.context.status(`Creating`);
      this.context.debug(
        `Creating lambda ${config.name} in the ${config.region} region.`
      );

      const createResult = await createLambda({ lambda, ...config });
      config.arn = createResult.arn;
      config.hash = createResult.hash;
    } else {
      config.arn = prevLambda.arn;

      if (configChanged(prevLambda, config)) {
        if (config.bucket && prevLambda.hash !== config.hash) {
          this.context.status(`Uploading code`);
          this.context.debug(
            `Uploading ${config.name} lambda code to bucket ${config.bucket}.`
          );

          await deploymentBucket.upload({
            name: config.bucket,
            file: config.zipPath
          });
          await updateLambdaCode({ lambda, ...config });
        } else if (!config.bucket && prevLambda.hash !== config.hash) {
          this.context.status(`Uploading code`);
          this.context.debug(`Uploading ${config.name} lambda code.`);
          await updateLambdaCode({ lambda, ...config });
        }

        this.context.status(`Updating`);
        this.context.debug(`Updating ${config.name} lambda config.`);

        const updateResult = await updateLambdaConfig({ lambda, ...config });
        config.hash = updateResult.hash;
      }
    }

    // todo we probably don't need this logic now that we auto generate names
    if (this.state.name && this.state.name !== config.name) {
      this.context.status(`Replacing`);
      await deleteLambda({ lambda, name: this.state.name });
    }

    this.context.debug(
      `Successfully deployed lambda ${config.name} in the ${config.region} region.`
    );

    const outputs = pick(outputsList, config);

    this.state = outputs;
    await this.save();

    return outputs;
  }

  async publishVersion() {
    const { name, region, hash } = this.state;

    const lambda = new AwsSdkLambda({
      region,
      credentials: this.context.credentials.aws
    });

    const { Version } = await lambda
      .publishVersion({
        FunctionName: name,
        CodeSha256: hash
      })
      .promise();

    return { version: Version };
  }

  async remove() {
    this.context.status(`Removing`);

    if (!this.state.name) {
      this.context.debug(`Aborting removal. Function name not found in state.`);
      return;
    }

    const { name, region } = this.state;

    const lambda = new AwsSdkLambda({
      region,
      credentials: this.context.credentials.aws
    });

    const awsIamRole = await this.load("@serverless/aws-iam-role");
    const layer = await this.load("@serverless/aws-lambda-layer");

    await awsIamRole.remove();
    await layer.remove();

    this.context.debug(`Removing lambda ${name} from the ${region} region.`);
    await deleteLambda({ lambda, name });
    this.context.debug(
      `Successfully removed lambda ${name} from the ${region} region.`
    );

    const outputs = pick(outputsList, this.state);

    this.state = {};
    await this.save();

    return outputs;
  }
}

module.exports = AwsLambda;
