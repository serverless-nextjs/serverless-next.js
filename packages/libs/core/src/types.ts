// Incoming data

export type Header = {
  key?: string;
  value: string;
};

export type Request = {
  headers: { [key: string]: Header[] };
  querystring?: string;
  uri: string;
};

// Manifests

export type RedirectData = {
  statusCode: number;
  source: string;
  destination: string;
  regex: string;
  internal?: boolean;
};

export type DynamicSSG = {
  dataRoute: string;
  dataRouteRegex: string;
  fallback: false | null | string;
  routeRegex: string;
};

export type Manifest = {
  authentication?: {
    username: string;
    password: string;
  };
  buildId: string;
  domainRedirects?: {
    [key: string]: string;
  };
  pages?: {
    html: {
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
      nonDynamic: { [key: string]: string };
    };
    ssg: {
      dynamic: {
        [key: string]: DynamicSSG;
      };
      nonDynamic: {
        [key: string]: {
          initialRevalidateSeconds?: false | number;
          srcRoute: string | null;
          dataRoute: string;
        };
      };
    };
    ssr: {
      catchAll: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
      nonDynamic: { [key: string]: string };
    };
  };
  publicFiles?: {
    [key: string]: string;
  };
  trailingSlash?: boolean;
};

export type I18nData = {
  locales: string[];
  defaultLocale: string;
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  i18n?: I18nData;
};

export type PrerenderManifest = {
  preview: {
    previewModeId: string;
    previewModeSigningKey: string;
    previewModeEncryptionKey: string;
  };
};

// Returned routes

export interface AnyRoute {
  file?: string;
  headers?: { [key: string]: Header[] };
  isPublicFile?: boolean;
  isRedirect?: boolean;
  isRender?: boolean;
  isStatic?: boolean;
  isUnauthorized?: boolean;
}

export interface PublicFileRoute extends AnyRoute {
  isPublicFile: true;
  file: string;
}

export interface RedirectRoute extends AnyRoute {
  isRedirect: true;
  status: number;
  statusDescription: string;
}

// Render route, like SSR, preview etc.
export interface RenderRoute extends AnyRoute {
  isRender: true;
  isData: boolean;
  page: string;
}

// Static route, whether HTML or SSG (non-preview)
export interface StaticRoute extends AnyRoute {
  isStatic: true;
  isData: boolean;
  file: string;
}

export interface UnauthorizedRoute extends AnyRoute {
  isUnauthorized: true;
  status: number;
  statusDescription: string;
  body: string;
}

export type DataRoute = (RenderRoute | StaticRoute) & {
  isData: true;
};

export type Route =
  | DataRoute
  | PublicFileRoute
  | RedirectRoute
  | StaticRoute
  | UnauthorizedRoute;
