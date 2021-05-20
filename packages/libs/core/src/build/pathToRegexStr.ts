import { pathToRegexp } from "path-to-regexp";
import { expressifyDynamicRoute } from "./expressifyDynamicRoute";

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
