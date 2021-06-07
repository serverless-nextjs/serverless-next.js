import { getLocalePrefixFromUri } from "../route/locale";
import { Event, PageManifest, RoutesManifest, StaticRoute } from "../types";

export const renderErrorPage = async (
  error: any,
  event: Event,
  route: { page: string; isData: boolean },
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<void | StaticRoute> => {
  console.error(
    `Error rendering page: ${route.page}. Error:\n${error}\nRendering Next.js error page.`
  );

  const { req, res } = event;
  const localePrefix = getLocalePrefixFromUri(req.url ?? "", routesManifest);

  // Render static error page if present by returning static route
  const errorRoute = `${localePrefix}/500`;
  const staticErrorPage =
    manifest.pages.html.nonDynamic[errorRoute] ||
    manifest.pages.ssg.nonDynamic[errorRoute];
  if (staticErrorPage) {
    return {
      isData: route.isData,
      isStatic: true,
      file: `pages${localePrefix}/500.html`,
      statusCode: 500
    };
  } else {
    // Set status to 500 so _error.js will render a 500 page
    res.statusCode = 500;
    const errorPage = getPage("./pages/_error.js");
    await Promise.race([errorPage.render(req, res), event.responsePromise]);
  }
};
