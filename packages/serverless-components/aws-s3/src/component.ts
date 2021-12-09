import * as path from "path";
import { mergeDeepRight } from "ramda";
import { Component, utils } from "@serverless/core";
import {
  getClients,
  clearBucket,
  accelerateBucket,
  deleteBucket,
  uploadDir,
  packAndUploadDir,
  uploadFile,
  ensureBucket,
  configureCors,
  configureBucketTags
} from "./utils";

const defaults = {
  name: undefined,
  accelerated: true,
  region: "us-east-1",
  tags: undefined
};

class AwsS3 extends Component {
  context: any;
  state: any;
  save: () => void;

  async default(inputs: any = {}) {
    const config = mergeDeepRight(defaults, inputs);

    this.context.status(`Deploying`);

    config.name = inputs.name || this.state.name || this.context.resourceId();
    config.tags = inputs.tags || this.state.tags;

    this.context.debug(
      `Deploying bucket ${config.name} in region ${config.region}.`
    );

    const clients = getClients(this.context.credentials.aws, config.region);
    await ensureBucket(clients.regular, config.name, this.context.debug);

    // todo we probably don't need this logic now that we auto generate names
    if (config.accelerated) {
      if (config.name.includes(".")) {
        throw new Error(
          "Accelerated buckets must be DNS-compliant and must NOT contain periods"
        );
      }

      this.context.debug(
        `Setting acceleration to "${config.accelerated}" for bucket ${config.name}.`
      );
      await accelerateBucket(clients.regular, config.name, config.accelerated);
    }

    if (config.cors) {
      this.context.debug(`Setting cors for bucket ${config.name}.`);
      await configureCors(clients.regular, config.name, config.cors);
    }

    if (config.tags) {
      this.context.debug(`Configuring tags for bucket ${config.name}.`);
      await configureBucketTags(clients.regular, config.name, config.tags);
    }

    // todo we probably don't need this logic now that we auto generate names
    const nameChanged = this.state.name && this.state.name !== config.name;
    if (nameChanged) {
      await this.remove();
    }

    this.state.name = config.name;
    this.state.region = config.region;
    this.state.accelerated = config.accelerated;
    this.state.url = `https://${config.name}.s3.amazonaws.com`;
    this.state.tags = config.tags;
    await this.save();

    this.context.debug(
      `Bucket ${config.name} was successfully deployed to the ${config.region} region.`
    );
    return this.state;
  }

  async remove() {
    this.context.status(`Removing`);

    if (!this.state.name) {
      this.context.debug(`Aborting removal. Bucket name not found in state.`);
      return;
    }

    const clients = getClients(this.context.credentials.aws, this.state.region);

    this.context.debug(`Clearing bucket ${this.state.name} contents.`);

    await clearBucket(
      this.state.accelerated ? clients.accelerated : clients.regular,
      this.state.name
    );

    this.context.debug(
      `Deleting bucket ${this.state.name} from region ${this.state.region}.`
    );

    await deleteBucket(clients.regular, this.state.name);

    this.context.debug(
      `Bucket ${this.state.name} was successfully deleted from region ${this.state.region}.`
    );

    const outputs = {
      name: this.state.name,
      region: this.state.region,
      accelerated: this.state.accelerated
    };

    this.state = {};
    await this.save();

    return outputs;
  }

  async upload(inputs: any = {}) {
    this.context.status("Uploading");

    const name = this.state.name || inputs.name;
    const region = this.state.region || inputs.region || defaults.region;

    if (!name) {
      throw Error("Unable to upload. Bucket name not found in state.");
    }

    this.context.debug(`Starting upload to bucket ${name} in region ${region}`);

    const clients = getClients(this.context.credentials.aws, region);

    if (inputs.dir && (await utils.dirExists(inputs.dir))) {
      if (inputs.zip) {
        this.context.debug(
          `Packing and uploading directory ${inputs.dir} to bucket ${name}`
        );
        // pack & upload using multipart uploads
        const defaultKey = Math.random().toString(36).substring(6);

        await packAndUploadDir({
          s3: this.state.accelerated ? clients.accelerated : clients.regular,
          bucketName: name,
          dirPath: inputs.dir,
          key: inputs.key || `${defaultKey}.zip`,
          cacheControl: inputs.cacheControl
        });
      } else {
        this.context.debug(
          `Uploading directory ${inputs.dir} to bucket ${name}`
        );
        // upload directory contents
        await uploadDir(
          this.state.accelerated ? clients.accelerated : clients.regular,
          name,
          inputs.dir,
          inputs.cacheControl,
          { keyPrefix: inputs.keyPrefix }
        );
      }
    } else if (inputs.file && (await utils.fileExists(inputs.file))) {
      // upload a single file using multipart uploads
      this.context.debug(`Uploading file ${inputs.file} to bucket ${name}`);

      await uploadFile({
        s3: this.state.accelerated ? clients.accelerated : clients.regular,
        bucketName: name,
        filePath: inputs.file,
        key: inputs.key || path.basename(inputs.file),
        cacheControl: inputs.cacheControl
      });

      this.context.debug(
        `File ${inputs.file} uploaded with key ${
          inputs.key || path.basename(inputs.file)
        }`
      );
    }
  }
}

export default AwsS3;
