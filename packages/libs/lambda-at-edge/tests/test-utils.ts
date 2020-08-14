import path from "path";
import { remove } from "fs-extra";
import {
  CloudFrontOrigin,
  CloudFrontEvent,
  CloudFrontResponse
} from "aws-lambda";
import { OriginRequestEvent } from "../types";

export const cleanupDir = (dir: string): Promise<void> => {
  return remove(dir);
};

export const removeNewLineChars = (text: string): string =>
  text.replace(/(\r\n|\n|\r)/gm, "");

export const getNextBinary = (): string =>
  path.join(require.resolve("next"), "../../../../.bin/next");

type CloudFrontEventOptions = {
  uri: string;
  host: string;
  s3DomainName?: string;
  s3Region?: string;
  origin?: CloudFrontOrigin;
  config?: CloudFrontEvent["config"];
  response?: CloudFrontResponse;
};

export const createCloudFrontEvent = ({
  uri,
  host,
  s3DomainName,
  s3Region,
  config = {} as any,
  response
}: CloudFrontEventOptions): OriginRequestEvent => ({
  Records: [
    {
      cf: {
        config,
        request: {
          method: "GET",
          uri,
          clientIp: "1.2.3.4",
          querystring: "",
          headers: {
            host: [
              {
                key: "host",
                value: host
              }
            ]
          },
          origin: {
            s3: {
              path: "",
              region: s3Region || "us-east-1",
              authMethod: "origin-access-identity",
              domainName: s3DomainName || "my-bucket.s3.amazonaws.com"
            }
          }
        },
        response
      }
    }
  ]
});
