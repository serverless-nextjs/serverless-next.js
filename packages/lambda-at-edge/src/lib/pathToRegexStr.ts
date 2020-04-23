import { pathToRegexp } from "path-to-regexp";

export default (path: string): string =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, "$1");
