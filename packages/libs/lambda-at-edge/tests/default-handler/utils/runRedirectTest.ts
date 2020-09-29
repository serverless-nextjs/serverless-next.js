import { createCloudFrontEvent } from "../../test-utils";
import { CloudFrontResultResponse } from "aws-lambda";

export async function runRedirectTestWithHandler(
  handler: Function,
  path: string,
  expectedRedirect: string,
  statusCode: number,
  querystring?: string
): Promise<void> {
  const event = createCloudFrontEvent({
    uri: path,
    host: "mydistribution.cloudfront.net",
    config: { eventType: "origin-request" } as any,
    querystring: querystring
  });

  const result = await handler(event);
  const response = result as CloudFrontResultResponse;

  const refresh: [{ key: string; value: string }] | [] =
    statusCode === 308
      ? [
          {
            key: "Refresh",
            value: `0;url=${expectedRedirect}`
          }
        ]
      : [];

  expect(response.headers).toEqual({
    location: [
      {
        key: "Location",
        value: expectedRedirect
      }
    ],
    refresh: refresh
  });
  expect(response.status).toEqual(statusCode.toString());
}
