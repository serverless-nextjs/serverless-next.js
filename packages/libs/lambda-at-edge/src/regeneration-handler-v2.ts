// @ts-ignore
import Manifest from "./manifest.json";
import { OriginRequestDefaultHandlerManifest } from "./types";
import { AwsPlatformClient } from "@sls-next/aws-common";
import Stream from "stream";
import http from "http";
import {
  regenerationHandler,
  RegenerationEvent,
  RegenerationEventRequest
} from "@sls-next/core";
import AWSLambda from "aws-lambda";

export const handler = async (event: AWSLambda.SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      const regenerationEvent: RegenerationEvent = JSON.parse(record.body);
      const manifest: OriginRequestDefaultHandlerManifest = Manifest;

      // Build request object from the regeneration event
      const originalRequest: RegenerationEventRequest =
        regenerationEvent.request;
      const req = Object.assign(
        new Stream.Readable(),
        http.IncomingMessage.prototype
      );
      req.url = originalRequest.url; // this already includes query parameters
      req.headers = originalRequest.headers;
      const res = Object.assign(
        new Stream.Readable(),
        http.ServerResponse.prototype
      );

      // TODO: In the future we may want to have bucket details in a manifest instead of the regen event.
      //  Though it will have to be updated at deploy time since we do not know randomly generated names until deployed unless user set a custom one.
      const awsPlatformClient = new AwsPlatformClient(
        regenerationEvent.storeName,
        regenerationEvent.storeRegion,
        undefined, // we don't need to call the SQS queue so pass undefined for these
        undefined
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
