import { matchPath } from "../match";
import { addDefaultLocaleToPath } from "../route/locale";
import { Event, Headers, Route, RoutesManifest } from "../types";

export const getCustomHeaders = (
  uri: string,
  routesManifest: RoutesManifest
) => {
  const localized = addDefaultLocaleToPath(uri, routesManifest);
  const headers: Headers = {};
  for (const headerData of routesManifest.headers) {
    if (!matchPath(localized, headerData.source)) {
      continue;
    }
    for (const { key, value } of headerData.headers) {
      if (key) {
        // Header overriding behavior as per:
        // https://nextjs.org/docs/api-reference/next.config.js/headers
        headers[key.toLowerCase()] = [{ key, value }];
      }
    }
  }
  return headers;
};

export const setCustomHeaders = (
  event: Event,
  routesManifest: RoutesManifest
) => {
  const [uri] = (event.req.url ?? "").split("?");
  const headers = getCustomHeaders(uri, routesManifest);
  for (const [{ key, value }] of Object.values(headers)) {
    if (key) {
      event.res.setHeader(key, value);
    }
  }
};

export const setHeadersFromRoute = (event: Event, route: Route) => {
  for (const [key, headers] of Object.entries(route.headers || [])) {
    const keys = headers.map(({ key }) => key);
    const values = headers.map(({ value }) => value).join(";");
    if (values) {
      event.res.setHeader(keys[0] ?? key, values);
    }
  }
};
