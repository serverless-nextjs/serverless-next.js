// @ts-ignore
import Manifest from "./manifest.json";
import { OriginRequestDefaultHandlerManifest } from "./types";
import { AwsPlatformClient } from "@sls-next/aws-common";
import Stream from "stream";
import http from "http";
import { regenerationHandler, RegenerationEvent } from "@sls-next/core";
import AWSLambda from "aws-lambda";

export const handler = async (event: AWSLambda.SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      const regenerationEvent: RegenerationEvent = JSON.parse(record.body);
      const manifest: OriginRequestDefaultHandlerManifest = Manifest;

      const req = Object.assign(
        new Stream.Readable(),
        http.IncomingMessage.prototype
      );
      const res = Object.assign(
        new Stream.Readable(),
        http.ServerResponse.prototype
      );

      // TODO: In the future we may want to have bucket and queue details in a manifest instead of the regen event.
      //  Though it will have to be updated at deploy time since we do not know randomly generated names until deployed unless user set a custom one.
      const awsPlatformClient = new AwsPlatformClient(
        regenerationEvent.storeName,
        regenerationEvent.storeRegion,
        regenerationEvent.queueName,
        regenerationEvent.queueRegion
      );

      await regenerationHandler({
        req,
        res,
        regenerationEvent,
        manifest,
        platformClient: awsPlatformClient
      });
    })
  );
};
