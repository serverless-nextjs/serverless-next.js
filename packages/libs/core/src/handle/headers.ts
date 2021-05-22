import { matchPath } from "../match";
import { Event, Route, RoutesManifest } from "../types";

export const setCustomHeaders = (
  event: Event,
  routesManifest: RoutesManifest
) => {
  const [uri] = (event.req.url ?? "").split("?");
  for (const headerData of routesManifest.headers) {
    if (!matchPath(uri, headerData.source)) {
      continue;
    }
    for (const { key, value } of headerData.headers) {
      event.res.setHeader(key!, value);
    }
  }
};

export const setHeadersFromRoute = (event: Event, route: Route) => {
  for (const [key, headers] of Object.entries(route.headers || [])) {
    const keys = headers.map(({ key }) => key);
    const values = headers.map(({ value }) => value).join(";");
    event.res.setHeader(keys[0] ?? key, values);
  }
};
