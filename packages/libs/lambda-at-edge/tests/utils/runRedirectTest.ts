import { createCloudFrontEvent } from "../test-utils";
import { CloudFrontResultResponse } from "aws-lambda";

export async function runRedirectTestWithHandler(
  // eslint-disable-next-line @typescript-eslint/ban-types
  handler: Function,
  path: string,
  expectedRedirect: string,
  statusCode: number,
  querystring?: string,
  host?: string,
  requestHeaders?: { [p: string]: { key: string; value: string }[] }
): Promise<void> {
  const event = createCloudFrontEvent({
    uri: path,
    host: host ?? "mydistribution.cloudfront.net",
    config: { eventType: "origin-request" } as any,
    querystring: querystring,
    requestHeaders: requestHeaders
  });

  const result = await handler(event);
  const response = result as CloudFrontResultResponse;

  const refresh: [{ key: string; value: string }] | undefined =
    statusCode === 308
      ? [
          {
            key: "Refresh",
            value: `0;url=${expectedRedirect}`
          }
        ]
      : undefined;

  expect(response.headers).toEqual({
    location: [
      {
        key: "Location",
        value: expectedRedirect
      }
    ],
    refresh: refresh,
    "cache-control": [
      {
        key: "Cache-Control",
        value: "s-maxage=0"
      }
    ]
  });
  expect(response.status.toString()).toEqual(statusCode.toString());
}
