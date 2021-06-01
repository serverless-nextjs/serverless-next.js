import { createRequestEvent } from "../test-utils";

export async function runRedirectTestWithHandler(
  // eslint-disable-next-line @typescript-eslint/ban-types
  handler: Function,
  path: string,
  expectedRedirect: string,
  statusCode: number,
  querystring?: string,
  host?: string,
  headers?: { key: string; value: string }
): Promise<void> {
  const event = createRequestEvent({
    uri: path,
    querystring: querystring,
    headers: { ...headers, ...(host ? { Host: host } : {}) }
  });

  const result = await handler(event);

  const refresh: string | undefined =
    statusCode === 308 ? `0;url=${expectedRedirect}` : undefined;

  expect(result.headers).toEqual({
    Location: expectedRedirect,
    Refresh: refresh
  });
  expect(result.statusCode.toString()).toEqual(statusCode.toString());
}
