import {
  OriginRequestDefaultHandlerManifest as Manifest,
  PreRenderedManifest as PrerenderManifest,
  RevalidationEvent,
  RoutesManifest
} from "../../types";
import {
  Resource,
  FallbackRoute,
  PrerenderRoute,
  ResourceForIndexPage
} from "./resource";
import { debug } from "../lib/console";

const _ = require("../../../tools/lodash.min");
const a = _.isEmpty("d");

export class ResourceService {
  constructor(
    private readonly manifest: Manifest,
    private readonly prerenderManifest: PrerenderManifest,
    private readonly routesManifest: RoutesManifest
  ) {}

  public get(event: RevalidationEvent): Resource | ResourceForIndexPage {
    const resource = this.generateBasicResource(event);
    resource.routes = {
      fallback: this.findFallbackRoute(resource),
      prerender: this.findPrerenderRoute(resource),
      public: this.findPublicRoute(resource),
      static: this.findStaticRoute(resource),
      page: this.findPageRoute(resource)
    };

    return resource;
  }

  private generateBasicResource(
    event: RevalidationEvent
  ): Resource | ResourceForIndexPage {
    const request = event.Records[0].cf.request;
    const uri = request.uri.replace(this.getBasePath(), "");

    if (uri.endsWith("/index.html")) {
      // for all */index page
      debug(`Rendered with Resource For Index Page`);
      return new ResourceForIndexPage(
        uri,
        this.getBasePath(),
        this.getBuildId()
      );
    }
    debug(`Rendered with Basic Resource`);
    return new Resource(uri, this.getBasePath(), this.getBuildId());
  }

  public getBasePath(): string {
    return this.routesManifest.basePath || "";
  }

  public getBuildId(): string {
    return this.manifest.buildId;
  }

  public findStaticRoute(resource: Resource): string | undefined {
    return this.manifest.pages.html.nonDynamic[resource.getNormalUri()];
  }

  public findPublicRoute(resource: Resource): string | undefined {
    return this.manifest.publicFiles[resource.getNormalUri()];
  }

  public findPrerenderRoute(resource: Resource): PrerenderRoute | undefined {
    return this.prerenderManifest.routes[resource.getNormalUri()];
  }

  public findPageRoute(resource: Resource): string | undefined {
    const uri = resource.getCanonicalUri();

    const {
      pages: { ssr, html }
    } = this.manifest;

    const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

    if (ssr.nonDynamic[uri]) {
      return ssr.nonDynamic[uri];
    }

    if (html.nonDynamic[uri]) {
      return html.nonDynamic[uri];
    }

    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(uri);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // only use the 404 page if the project exports it
    if (html.nonDynamic["/404"] !== undefined) {
      return "pages/404.html";
    }

    return "pages/_error.js";
  }

  public findFallbackRoute(resource: Resource): FallbackRoute | undefined {
    const {
      pages: { ssr, html }
    } = this.manifest;
    const uri = resource.getNormalUri();
    // Non-dynamic routes are prioritized over dynamic fallbacks, return false to ensure those get rendered instead
    if (ssr.nonDynamic[uri] || html.nonDynamic[uri]) {
      return undefined;
    }

    let foundFallback: FallbackRoute | undefined = undefined; // for later use to reduce duplicate work

    // Dynamic routes that does not have fallback are prioritized over dynamic fallback
    const isNonFallbackDynamicRoute = Object.values({
      ...ssr.dynamic,
      ...html.dynamic
    }).find((dynamicRoute) => {
      if (foundFallback) {
        return false;
      }

      const re = new RegExp(dynamicRoute.regex);
      const matchesRegex = re.test(uri);

      // If any dynamic route matches, check that this isn't one of the fallback routes in prerender manifest
      if (matchesRegex) {
        const matchesFallbackRoute = Object.keys(
          this.prerenderManifest.dynamicRoutes
        ).find((prerenderManifestRoute) => {
          const fileMatchesPrerenderRoute =
            dynamicRoute.file === `pages${prerenderManifestRoute}.js`;

          if (fileMatchesPrerenderRoute) {
            foundFallback = this.prerenderManifest.dynamicRoutes[
              prerenderManifestRoute
            ];
          }

          return fileMatchesPrerenderRoute;
        });

        return !matchesFallbackRoute;
      } else {
        return false;
      }
    });

    if (isNonFallbackDynamicRoute) {
      return undefined;
    }

    // If fallback previously found, return it to prevent additional regex matching
    if (foundFallback) {
      return foundFallback;
    }

    // Otherwise, try to match fallback against dynamic routes in prerender manifest
    return Object.values(this.prerenderManifest.dynamicRoutes).find(
      (routeConfig) => {
        const re = new RegExp(routeConfig.routeRegex);
        return re.test(uri);
      }
    );
  }
}
