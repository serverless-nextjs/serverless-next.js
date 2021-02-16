/**
 * We don't need to invalidate sub paths if a parent has a wild card
 * invalidation. i.e. if `/users/*` exists, we don't need to invalidate `/users/details/*`
 */
export const reduceInvalidationPaths = (
  invalidationPaths: string[]
): string[] => {
  const wildCardDirectories = invalidationPaths
    .filter((invalidationPath) => invalidationPath.endsWith("/*"))
    .map((invalidationPath) => invalidationPath.replace("/*", ""));

  return invalidationPaths.filter((invalidationPath) => {
    return !wildCardDirectories.some(
      (wildCardDirectory) =>
        invalidationPath.startsWith(wildCardDirectory) &&
        invalidationPath !== `${wildCardDirectory}*` &&
        invalidationPath !== `${wildCardDirectory}/*` &&
        wildCardDirectory !== invalidationPath
    );
  });
};
