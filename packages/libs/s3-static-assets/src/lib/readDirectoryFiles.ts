import fse from "fs-extra";
import path from "path";
import glob, { Entry } from "fast-glob";

const readDirectoryFiles = (directory: string): Array<Entry> => {
  const directoryExists = fse.pathExistsSync(directory);
  if (!directoryExists) {
    return [];
  }

  // fast-glob only accepts posix paths, hence why we don't use path.join, which will cause empty directory list on Windows filesystems.
  return glob.sync(path.posix.join(directory, "**/*"), {
    onlyFiles: true,
    stats: true
  });
};

export default readDirectoryFiles;
