import { pathToRegexp } from "path-to-regexp";
import { expressifyDynamicRoute } from "./expressifyDynamicRoute";

export const pathToRegexStr = (path: string): string =>
  pathToRegexp(expressifyDynamicRoute(path))
    .toString()
    .replace(/\/(.*)\/\i/, "$1");
