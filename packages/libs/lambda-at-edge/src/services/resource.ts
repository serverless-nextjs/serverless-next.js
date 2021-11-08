export interface FallbackRoute {
  routeRegex: string;
  fallback: string | false;
  dataRoute: string;
  dataRouteRegex: string;
}

export interface PrerenderRoute {
  initialRevalidateSeconds: number | false;
  srcRoute: string | null;
  dataRoute: string;
}

export interface ResourceRoutes {
  fallback?: FallbackRoute;
  prerender?: PrerenderRoute;
  public?: string;
  static?: string;
  page?: string;
}

export class Resource {
  public routes: ResourceRoutes = {};

  constructor(
    private readonly uri: string,
    private readonly basePath: string,
    private readonly buildId: string
  ) {}

  public isData(): boolean {
    return !!this.uri.match(/\/_next\/data/);
  }

  public getPagePath(): string | undefined {
    return this.routes.page;
  }

  public getHtmlKey(): string {
    return `${(this.basePath || "").replace(/^\//, "")}${
      !this.basePath ? "" : "/"
    }static-pages/${this.buildId}${this.getCanonicalUri()}.html`;
  }

  public getHtmlUri(): string {
    return `${this.basePath || ""}${this.getCanonicalUri()}`;
  }

  public getJsonKey(): string {
    return `${(this.basePath || "").replace(/^\//, "")}${
      !this.basePath ? "" : "/"
    }_next/data/${this.buildId}${this.getCanonicalUri()}.json`;
  }

  public getJsonUri(): string {
    return `/${this.getJsonKey()}`;
  }

  public getNormalUri(): string {
    let normalizedUri = this.uri;
    if (this.basePath && this.uri.startsWith(this.basePath)) {
      normalizedUri = normalizedUri.slice(this.basePath.length);
    }
    // Remove trailing slash for all paths
    if (normalizedUri.endsWith("/")) {
      normalizedUri = normalizedUri.slice(0, -1);
    }
    // Empty path should be normalised to "/" as there is no Next.js route for ""
    return ["/index", ""].includes(normalizedUri)
      ? "/"
      : decodeURI(normalizedUri);

    return normalizedUri === "" ? "/" : decodeURI(normalizedUri);
  }

  public getCanonicalUri(): string {
    return this.getNormalUri()
      .replace(`${this.basePath}`, "")
      .replace(`_next/data/${this.buildId}/`, "")
      .replace(".json", "")
      .replace(".html", "");
  }

  public getUri(): string {
    return this.uri;
  }

  public getBasePath(): string {
    return this.basePath;
  }

  public getBuildId(): string {
    return this.buildId;
  }
}

/**
 * this resource is just for all /index pages
 * it means this resource uri should endsWith "/index.html";
 * For pages/[somepath]/index, it will render with Resource and
 * the js path is pages/[somapath].js
 */
export class ResourceForIndexPage extends Resource {
  public getPagePath(): string | undefined {
    return "pages/index.js";
  }

  public getCanonicalUri(): string {
    return "/index";
  }

  public getHtmlUri(): string {
    return this.getBasePath() || "";
  }
}
