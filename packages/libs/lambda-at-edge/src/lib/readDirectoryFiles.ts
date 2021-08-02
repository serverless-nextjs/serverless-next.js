import fse from "fs-extra";
import path from "path";
import glob, { Entry } from "fast-glob";
import normalizePath from "normalize-path";

const readDirectoryFiles = async (
  directory: string,
  ignorePatterns: string[]
): Promise<Array<Entry>> => {
  const directoryExists = fse.pathExistsSync(directory);
  if (!directoryExists) {
    return [];
  }

  // fast-glob only accepts posix paths so we normalize it
  const normalizedDirectory = normalizePath(directory);

  return await glob(path.posix.join(normalizedDirectory, "**", "*"), {
    onlyFiles: true,
    stats: true,
    dot: true, // To allow matching dot files or directories
    ignore: ignorePatterns
  });
};

export default readDirectoryFiles;
