import { handleRender } from "./default";
import { setCustomHeaders } from "./headers";
import {
  Event,
  PageManifest,
  RenderRoute,
  Route,
  RoutesManifest,
  StaticRoute
} from "../types";
import { notFoundPage } from "../route/notfound";

type FallbackRoute = StaticRoute & {
  fallback: string | null;
  page: string;
};

type Fallback = {
  isStatic: false;
  route: FallbackRoute;
  html: string;
  renderOpts: any;
};

const handleFallbackRender = async (
  event: Event,
  route: FallbackRoute,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<Fallback | void> => {
  const { req, res } = event;
  setCustomHeaders(event, routesManifest);

  const page = getPage(route.page);
  try {
    const { html, renderOpts } = await page.renderReqToHTML(
      req,
      res,
      "passthrough"
    );
    return { isStatic: false, route, html, renderOpts };
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

export const handleFallback = async (
  event: Event,
  route: Route,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<StaticRoute | Fallback | void> => {
  // This should not be needed if all SSR routes are handled correctly
  if (route.isRender) {
    return handleRender(event, route as RenderRoute, routesManifest, getPage);
  }

  if (route.isStatic) {
    const staticRoute = route as StaticRoute;
    const shouldRender =
      (staticRoute.fallback && staticRoute.isData) ||
      staticRoute.fallback === null;
    if (shouldRender && staticRoute.page) {
      const fallback: FallbackRoute = staticRoute as FallbackRoute;
      return handleFallbackRender(event, fallback, routesManifest, getPage);
    }
    if (staticRoute.fallback) {
      return { ...staticRoute, file: `pages${staticRoute.fallback}` };
    }
  }

  const errorRoute = notFoundPage(
    event.req.url ?? "",
    manifest,
    routesManifest
  );
  if (errorRoute.isStatic) {
    return errorRoute as StaticRoute;
  }

  return handleRender(event, errorRoute, routesManifest, getPage);
};
