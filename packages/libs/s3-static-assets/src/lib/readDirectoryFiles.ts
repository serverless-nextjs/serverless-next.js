import fse from "fs-extra";
import path from "path";
import glob, { Entry } from "fast-glob";

const readDirectoryFiles = (directory: string): Array<Entry> => {
  const directoryExists = fse.pathExistsSync(directory);
  if (!directoryExists) {
    return [];
  }

  // fast-glob only accepts posix paths
  // we need to split directory by separator and use path.posix.join specifically to rejoin it
  // this should enable it to work on windows
  const directorySplit = directory.split(path.sep);

  // Ensure absolute path is preserved
  if (directorySplit.length > 0 && directorySplit[0] === "") {
    directorySplit[0] = "/";
  }

  return glob.sync(path.posix.join(...directorySplit, "**", "*"), {
    onlyFiles: true,
    stats: true,
    dot: true // To allow matching dot files or directories
  });
};

export default readDirectoryFiles;
