import { setCustomHeaders } from "./headers";
import { notFound } from "./notfound";
import { redirect } from "./redirect";
import { routeApi } from "../route";
import {
  ApiManifest,
  ApiRoute,
  Event,
  ExternalRoute,
  Headers,
  RedirectRoute,
  RoutesManifest,
  Request,
  UnauthorizedRoute
} from "../types";
import { unauthorized } from "./unauthorized";

const toRequest = (event: Event): Request => {
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

export const handleApi = async (
  event: Event,
  manifest: ApiManifest,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<ExternalRoute | void> => {
  const request = toRequest(event);
  const route = routeApi(request, manifest, routesManifest);
  if (!route) {
    return notFound(event);
  }
  if (route.querystring) {
    event.req.url = `${event.req.url}${request.querystring ? "&" : "?"}${
      route.querystring
    }`;
  }
  if (route.isApi) {
    const { page } = route as ApiRoute;
    setCustomHeaders(event, routesManifest);
    getPage(page).default(event.req, event.res);
    return;
  }
  if (route.isRedirect) {
    return redirect(event, route as RedirectRoute);
  }
  if (route.isUnauthorized) {
    return unauthorized(event, route as UnauthorizedRoute);
  }
  // No if lets typescript check this is ExternalRoute
  return route;
};
