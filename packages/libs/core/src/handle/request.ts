import { Event, Headers, Request } from "../types";

export const toRequest = (event: Event): Request => {
  const [uri, querystring] = (event.req.url ?? "").split("?");
  const headers: Headers = {};
  for (const [key, value] of Object.entries(event.req.headers)) {
    if (value && Array.isArray(value)) {
      headers[key.toLowerCase()] = value.map((value) => ({ key, value }));
    } else if (value) {
      headers[key.toLowerCase()] = [{ key, value }];
    }
  }
  return {
    headers,
    querystring,
    uri
  };
};
