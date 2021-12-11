import path from "path";
import fse from "fs-extra";
import { isPathInsideDir } from "./isPathInsideDir";

export const copyRequiredServerFiles = async ({
  nextConfigDir,
  destination
}: {
  nextConfigDir: string;
  destination: string;
}): Promise<void> => {
  const REQUIRED_SERVER_FILES = path.join(
    nextConfigDir,
    ".next/required-server-files.json"
  );

  try {
    const { files } = (await fse.readJSON(REQUIRED_SERVER_FILES)) as {
      files: string[];
    };

    const isInsideDestination = isPathInsideDir(destination);

    await Promise.all(
      files.map((file) => {
        const absoluteFile = path.join(nextConfigDir, file);
        const destinationFile = path.join(
          destination,
          path.relative(nextConfigDir, absoluteFile)
        );

        return isInsideDestination(destinationFile)
          ? fse.copy(absoluteFile, destinationFile, { errorOnExist: false })
          : Promise.resolve();
      })
    );
  } catch (error) {
    return Promise.reject(
      `Failed to process \`required-server-files.json\`. Check that you're using the \`outputFileTracing\` option with Node.js 12.`
    );
  }
};
