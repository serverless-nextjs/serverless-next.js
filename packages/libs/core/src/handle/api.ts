import { setCustomHeaders } from "./headers";
import { notFound } from "./notfound";
import { redirect } from "./redirect";
import { toRequest } from "./request";
import { routeApi } from "../route";
import {
  ApiManifest,
  ApiRoute,
  Event,
  ExternalRoute,
  RedirectRoute,
  RoutesManifest,
  UnauthorizedRoute
} from "../types";
import { unauthorized } from "./unauthorized";

/*
 * Handles api routes.
 *
 * Returns ExternalRoute for handling in the caller.
 *
 * If return is void, the response has already been generated in
 * event.res/event.responsePromise which the caller should wait on.
 */
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
    if (!event.req.hasOwnProperty("originalRequest")) {
      Object.defineProperty(event.req, "originalRequest", {
        get: () => event.req
      });
    }
    if (!event.res.hasOwnProperty("originalResponse")) {
      Object.defineProperty(event.res, "originalResponse", {
        get: () => event.res
      });
    }
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
