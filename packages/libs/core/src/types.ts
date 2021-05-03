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

export type I18nData = {
  locales: string[];
  defaultLocale: string;
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  i18n?: I18nData;
};

// Returned routes

export interface AnyRoute {
  file?: string;
  headers?: { [key: string]: Header[] };
  isPublicFile?: boolean;
  isRedirect?: boolean;
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

export interface UnauthorizedRoute extends AnyRoute {
  isUnauthorized: true;
  status: number;
  statusDescription: string;
  body: string;
}

export type Route = PublicFileRoute | RedirectRoute | UnauthorizedRoute;
