import { pathToRegexp } from "path-to-regexp";

/**
 * Convert any dynamic route to express route of the dynamic part.
 * @param dynamicRoute
 */
const expressifyDynamicRoute = (dynamicRoute: string): string => {
  return dynamicRoute
    .replace(/\[\[\.\.\.(.*)]]$/, ":$1*")
    .replace(/\[\.\.\.(.*)]$/, ":$1*")
    .replace(/\[(.*?)]/g, ":$1");
};

/*
 * Convert next.js path to regex
 * Does not handle optional parts!
 */
export const pathToRegexStr = (path: string): string => {
  try {
    return pathToRegexp(expressifyDynamicRoute(path))
      .toString()
      .replace(/\/(.*)\/\i/, "$1");
  } catch (exception) {
    console.error(
      `Unable to convert path to regex: ${path}. Please check for any special characters.`
    );
    throw exception;
  }
};
