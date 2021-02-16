import fse from "fs-extra";
import path from "path";
import glob, { Entry } from "fast-glob";

const readDirectoryFiles = (directory: string): Array<Entry> => {
  const directoryExists = fse.pathExistsSync(directory);
  if (!directoryExists) {
    return [];
  }

  return glob.sync(path.join(directory, "**/*"), {
    onlyFiles: true,
    stats: true
  });
};

export default readDirectoryFiles;
