export type Header = {
  key?: string;
  value: string;
};

export type Request = {
  headers: { [key: string]: Header[] };
  querystring?: string;
  uri: string;
};

export type Response = {
  status: string;
  statusDescription: string;
  body?: string;
  headers: { [key: string]: Header[] };
};

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
  trailingSlash?: boolean;
};

export type I18nData = {
  locales: string[];
  defaultLocale: string;
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  /*rewrites: RewriteData[];
  headers: HeaderData[];*/
  i18n?: I18nData;
};
