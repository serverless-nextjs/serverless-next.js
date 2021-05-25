import { setHeadersFromRoute } from "./headers";
import { Event, UnauthorizedRoute } from "../types";

export const unauthorized = (event: Event, route: UnauthorizedRoute) => {
  setHeadersFromRoute(event, route);
  event.res.statusCode = route.status;
  event.res.statusMessage = route.statusDescription;
  event.res.end();
};
