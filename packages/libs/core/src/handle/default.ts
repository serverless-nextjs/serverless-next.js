import { setCustomHeaders } from "./headers";
import { redirect } from "./redirect";
import { toRequest } from "./request";
import { routeDefault } from "../route";
import {
  Event,
  ExternalRoute,
  PageManifest,
  PrerenderManifest,
  PublicFileRoute,
  RedirectRoute,
  RenderRoute,
  RoutesManifest,
  StaticRoute,
  UnauthorizedRoute
} from "../types";
import { unauthorized } from "./unauthorized";

export const handleRender = async (
  event: Event,
  route: RenderRoute,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
) => {
  const { req, res } = event;
  setCustomHeaders(event, routesManifest);

  // If page is _error.js, set status to 404 so _error.js will render a 404 page
  if (route.page === "pages/_error.js") {
    res.statusCode = 404;
  }

  const page = getPage(route.page);
  try {
    if (route.isData) {
      const { renderOpts } = await page.renderReqToHTML(
        req,
        res,
        "passthrough"
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(renderOpts.pageData));
    } else {
      await Promise.race([page.render(req, res), event.responsePromise]);
    }
  } catch (error) {
    // Set status to 500 so _error.js will render a 500 page
    console.error(
      `Error rendering page: ${route.page}. Error:\n${error}\nRendering Next.js error page.`
    );
    res.statusCode = 500;
    const errorPage = getPage("./pages/_error.js");
    await Promise.race([errorPage.render(req, res), event.responsePromise]);
  }
};

export const handleDefault = async (
  event: Event,
  manifest: PageManifest,
  prerenderManifest: PrerenderManifest,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<ExternalRoute | PublicFileRoute | StaticRoute | void> => {
  const request = toRequest(event);
  const route = await routeDefault(
    request,
    manifest,
    prerenderManifest,
    routesManifest
  );
  if (route.querystring) {
    event.req.url = `${event.req.url}${request.querystring ? "&" : "?"}${
      route.querystring
    }`;
  }
  if (route.isRedirect) {
    return redirect(event, route as RedirectRoute);
  }
  if (route.isRender) {
    return handleRender(event, route as RenderRoute, routesManifest, getPage);
  }
  if (route.isUnauthorized) {
    return unauthorized(event, route as UnauthorizedRoute);
  }

  // No if lets typescript check this is ExternalRoute
  return route;
};
