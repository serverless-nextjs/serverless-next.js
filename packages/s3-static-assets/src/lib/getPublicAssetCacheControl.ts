import path from "path";
import regexParser from "regex-parser";
import {
  DEFAULT_PUBLIC_DIR_CACHE_CONTROL,
  DEFAULT_PUBLIC_DIR_CACHE_REGEX
} from "./constants";

export type PublicDirectoryCache =
  | boolean
  | {
      test?: string;
      value?: string;
    };

/**
 * If options is not present, or is explicitly set to true, returns a default Cache-Control configuration for image types.
 * If options is explicitly set to false, it returns undefined.
 * If assigned an options object, it uses whichever value is defined there, falling back to the default if one is not present.
 */
const getPublicAssetCacheControl = (
  filePath: string,
  options?: PublicDirectoryCache
): string | undefined => {
  if (options === false) {
    return undefined;
  }

  let value: string = DEFAULT_PUBLIC_DIR_CACHE_CONTROL;
  let test: RegExp = DEFAULT_PUBLIC_DIR_CACHE_REGEX;

  if (typeof options === "object") {
    if (options.value) {
      value = options.value;
    }

    if (options.test) {
      test = regexParser(options.test);
    }
  }

  if (test.test(path.basename(filePath))) {
    return value;
  }

  return undefined;
};

export default getPublicAssetCacheControl;
