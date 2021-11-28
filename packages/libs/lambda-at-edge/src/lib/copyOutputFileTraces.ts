import normalizeNodeModules from "@sls-next/core/dist/build/lib/normalizeNodeModules";
import fse from "fs-extra";
import path from "path";

/**
 * @see https://nextjs.org/docs/advanced-features/output-file-tracing
 */
export const copyOutputFileTraces = async ({
  serverlessDir,
  destination,
  pages
}: {
  serverlessDir: string;
  destination: string;
  pages: string[];
}): Promise<void> => {
  const DOT_NEXT = path.join(serverlessDir, "../");
  const NEXT_SERVER_JS_NFT_JSON = path.join(
    DOT_NEXT,
    "next-server.js.nft.json"
  );

  const nftJsonFiles = [NEXT_SERVER_JS_NFT_JSON].concat(
    pages.map((f) => `${f}.nft.json`)
  );

  const traces: Set<string> = new Set();

  const readNft = async (nft: string) => {
    const basePath = path.dirname(nft);
    try {
      const { files } = (await fse.readJSON(nft)) as { files: string[] };
      files.forEach((file) => {
        const absolutePath = path.join(basePath, file);
        traces.add(absolutePath);
      });
    } catch (error) {
      return Promise.reject(
        `Failed to read trace \`${nft}\`. Check that you're using the \`experimentalOutputFileTracing\` option with Node.js 12.`
      );
    }
  };

  await Promise.all(nftJsonFiles.map((file) => readNft(file)));

  await Promise.all(
    Array.from(traces)
      .filter((file) => !file.endsWith("package.json"))
      .map((file) => {
        const normalized = normalizeNodeModules(file);
        const destinationFile = path.join(
          destination,
          normalized.startsWith("node_modules/")
            ? normalized
            : path.relative(serverlessDir, file)
        );

        return fse.copy(file, destinationFile);
      })
  );
};
