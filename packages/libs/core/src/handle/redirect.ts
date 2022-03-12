import { setHeadersFromRoute } from "./headers";
import { Event, RedirectRoute } from "../types";

export const redirect = (event: Event, route: RedirectRoute) => {
  setHeadersFromRoute(event, route);
  event.res.statusCode = route.status;
  event.res.statusMessage = route.statusDescription;
  event.res.end();
};

export const redirectByPageProps = (event: Event, route: RedirectRoute) => {
  event.res.setHeader(
    "cache-control",
    route.headers?.cacheControl?.join(":") ?? ""
  );
  event.res.setHeader("Content-Type", "application/json");
  event.res.statusCode = 200;

  const body = {
    pageProps: {
      __N_REDIRECT: route.headers?.location[0].value ?? "",
      __N_REDIRECT_STATUS: route.status
    },
    __N_SSG: true
  };
  event.res.write(JSON.stringify(body));
  event.res.end();
};
