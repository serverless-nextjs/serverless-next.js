import path from "path";
import fs from "fs-extra";

const IMMUTABLE_CACHE_CONTROL_HEADER = "public, max-age=31536000, immutable";

const SERVER_CACHE_CONTROL_HEADER =
  "public, max-age=0, s-maxage=2678400, must-revalidate";

const DEFAULT_PUBLIC_DIR_CACHE_CONTROL =
  "public, max-age=31536000, must-revalidate";

type CacheConfig = Record<
  string,
  {
    cacheControl: string;
    path: string;
  }
>;

const filterNonExistentPathKeys = (config: CacheConfig) => {
  return Object.keys(config).reduce(
    (newConfig, nextConfigKey) => ({
      ...newConfig,
      ...(fs.pathExistsSync(config[nextConfigKey].path)
        ? { [nextConfigKey]: config[nextConfigKey] }
        : {})
    }),
    {} as CacheConfig
  );
};

const readAssetsDirectory = (options: {
  assetsDirectory: string;
}): CacheConfig => {
  const { assetsDirectory } = options;
  const publicFiles = path.join(assetsDirectory, "public");
  const staticFiles = path.join(assetsDirectory, "static");
  const staticPages = path.join(assetsDirectory, "static-pages");
  const nextData = path.join(assetsDirectory, "_next", "data");
  const nextStatic = path.join(assetsDirectory, "_next", "static");

  return filterNonExistentPathKeys({
    publicFiles: {
      path: publicFiles,
      cacheControl: DEFAULT_PUBLIC_DIR_CACHE_CONTROL
    },
    staticFiles: {
      path: staticFiles,
      cacheControl: DEFAULT_PUBLIC_DIR_CACHE_CONTROL
    },
    staticPages: {
      path: staticPages,
      cacheControl: SERVER_CACHE_CONTROL_HEADER
    },
    nextData: { path: nextData, cacheControl: SERVER_CACHE_CONTROL_HEADER },
    nextStatic: {
      path: nextStatic,
      cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER
    }
  });
};

export { readAssetsDirectory };
