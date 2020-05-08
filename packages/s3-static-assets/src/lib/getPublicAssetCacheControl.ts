import path from "path";
import regexParser from "regex-parser";
import {
  DEFAULT_ASSET_CACHE_CONTROL_HEADER,
  DEFAULT_ASSET_CACHE_REGEX
} from "./constants";

export type PublicAssetCacheControl =
  | boolean
  | {
      test?: string;
      value?: string;
    };

const getPublicAssetCacheControl = (
  filePath: string,
  options?: PublicAssetCacheControl
): string | undefined => {
  if (!options) {
    return undefined;
  }

  let value: string = DEFAULT_ASSET_CACHE_CONTROL_HEADER;
  let test: RegExp = DEFAULT_ASSET_CACHE_REGEX;

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
