import path from "path";
import fse from "fs-extra";

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

    await Promise.all(
      files.map((file) => {
        const absoluteFile = path.join(nextConfigDir, file);
        const destinationFile = path.join(
          destination,
          path.relative(".next/", file)
        );

        return fse.copy(absoluteFile, destinationFile, { errorOnExist: false });
      })
    );
  } catch (error) {
    return Promise.reject(
      `Failed to process \`required-server-files.json\`. Check that you're using the \`experimentalOutputFileTracing\` option with Node.js 12.`
    );
  }
};
