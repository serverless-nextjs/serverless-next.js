import path from "path";
import { remove } from "fs-extra";
import { OriginRequestEvent } from "../src/types";

export const cleanupDir = (dir: string): Promise<void> => {
  return remove(dir);
};

export const getNextBinary = (): string =>
  path.join(require.resolve("next"), "../../../../.bin/next");

export const createCloudFrontEvent = ({
  uri,
  host,
  origin
}): OriginRequestEvent => ({
  Records: [
    {
      cf: {
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
          origin
        }
      }
    }
  ]
});
