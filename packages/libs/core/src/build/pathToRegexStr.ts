import { pathToRegexp } from "path-to-regexp";

export const pathToRegexStr = (path: string): string =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, "$1");
