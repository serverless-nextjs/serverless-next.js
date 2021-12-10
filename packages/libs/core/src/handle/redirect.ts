import { setHeadersFromRoute } from "./headers";
import { Event, RedirectRoute } from "../types";

export const redirect = (event: Event, route: RedirectRoute) => {
  setHeadersFromRoute(event, route);
  event.res.statusCode = route.status;
  event.res.statusMessage = route.statusDescription;
  event.res.end();
};
