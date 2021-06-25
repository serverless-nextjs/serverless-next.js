// Incoming data
import { IncomingMessage, ServerResponse } from "http";

export type Header = {
  key?: string;
  value: string;
};

export type Headers = {
  [key: string]: Header[];
};

export type Request = {
  headers: Headers;
  querystring?: string;
  uri: string;
};

// Handlers map an Event into a Result

export type Event = {
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<any>;
};

// Manifests

export type RedirectData = {
  statusCode: number;
  source: string;
  destination: string;
  regex: string;
  internal?: boolean;
};

export type RewriteData = {
  source: string;
  destination: string;
  regex: string;
};

export type DynamicRoute = {
  route: string;
  regex: string;
};

export type Dynamic = {
  file: string;
  regex: string;
};

export type DynamicSSG = {
  fallback: false | null | string;
};

export type NonDynamicSSG = {
  initialRevalidateSeconds: false | number;
  srcRoute: string | null;
};

export type Manifest = {
  authentication?: {
    username: string;
    password: string;
  };
  domainRedirects?: {
    [key: string]: string;
  };
  publicFiles?: {
    [key: string]: string;
  };
  trailingSlash?: boolean;
};

export type ApiManifest = Manifest & {
  apis: {
    dynamic: Dynamic[];
    nonDynamic: { [key: string]: string };
  };
};

export type PageManifest = Manifest & {
  buildId: string;
  pages: {
    dynamic: DynamicRoute[];
    html: {
      dynamic: { [key: string]: string };
      nonDynamic: { [key: string]: string };
    };
    ssg: {
      dynamic: {
        [key: string]: DynamicSSG;
      };
      nonDynamic: {
        [key: string]: NonDynamicSSG;
      };
    };
    ssr: {
      dynamic: { [key: string]: string };
      nonDynamic: { [key: string]: string };
    };
  };
  publicFiles: {
    [key: string]: string;
  };
  trailingSlash: boolean;
};

export type HeaderData = {
  source: string;
  headers: Header[];
  regex: string;
};

export type DomainData = {
  domain: string;
  defaultLocale: string;
  locales?: string[];
};

export type I18nData = {
  locales: string[];
  defaultLocale: string;
  localeDetection?: boolean;
  domains?: DomainData[];
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  rewrites: RewriteData[];
  headers: HeaderData[];
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
  headers?: Headers;
  querystring?: string;
  statusCode?: number;
  isApi?: boolean;
  isExternal?: boolean;
  isPublicFile?: boolean;
  isRedirect?: boolean;
  isRender?: boolean;
  isStatic?: boolean;
  isUnauthorized?: boolean;
}

export interface ApiRoute extends AnyRoute {
  isApi: true;
  page: string;
}

export interface ExternalRoute extends AnyRoute {
  isExternal: true;
  path: string;
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
  page?: string;
  revalidate?: false | number;
  fallback?: false | null | string;
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

export type PageRoute = (RenderRoute | StaticRoute) & {
  isData: false;
};

export type Route =
  | ExternalRoute
  | PublicFileRoute
  | RedirectRoute
  | RenderRoute
  | StaticRoute
  | UnauthorizedRoute;
