import { isAbsolute, relative } from "path";

/** Returns `true` if `path` is inside `dir` */
export const isPathInsideDir = (dir: string) => (path: string) => {
  const relativePath = relative(dir, path);
  return (
    !!relativePath &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
};
