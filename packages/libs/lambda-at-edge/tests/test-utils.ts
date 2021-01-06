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
  querystring?: string;
  requestHeaders?: { [name: string]: { key: string; value: string }[] };
  method?: string;
  body?: {
    action: "read-only" | "replace";
    data: string;
    encoding: "base64" | "text";
    readonly inputTruncated: boolean;
  };
};

export const createCloudFrontEvent = ({
  uri,
  host,
  s3DomainName,
  s3Region,
  config = {} as any,
  response,
  querystring,
  requestHeaders = {},
  method = "GET",
  body = undefined
}: CloudFrontEventOptions): OriginRequestEvent => ({
  Records: [
    {
      cf: {
        config,
        request: {
          method: method,
          uri,
          clientIp: "1.2.3.4",
          querystring: querystring ?? "",
          headers: {
            host: [
              {
                key: "host",
                value: host
              }
            ],
            ...requestHeaders
          },
          origin: {
            s3: {
              path: "",
              region: s3Region || "us-east-1",
              authMethod: "origin-access-identity",
              domainName: s3DomainName || "my-bucket.s3.amazonaws.com"
            }
          },
          body: body
        },
        response
      }
    }
  ]
});
