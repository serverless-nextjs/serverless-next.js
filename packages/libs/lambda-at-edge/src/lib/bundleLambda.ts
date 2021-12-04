import { Runtime as LambdaRuntime } from "@aws-cdk/aws-lambda/lib/runtime";
import readDirectoryFiles from "@sls-next/core/dist/build/lib/readDirectoryFiles";
import type { ServerlessComponentInputs } from "@sls-next/serverless-component/types";
import { build } from "esbuild";
import glob from "fast-glob";
import fse from "fs-extra";
import path from "path";

const TARGET_FILE = "bundle.js";

type Runtime = NonNullable<ServerlessComponentInputs["runtime"]>;

const getTarget = (input?: string): string => {
  switch (input) {
    case LambdaRuntime.NODEJS_14_X.name:
      return "node14";
    case LambdaRuntime.NODEJS_10_X.name:
      return "node10";
    case LambdaRuntime.NODEJS_12_X.name:
    default:
      return "node12";
  }
};

export const bundleLambda = async (
  outputDir: string,
  handler: string,
  runtime: Runtime | null
) => {
  const target = path.join(outputDir, handler);
  const index = path.join(target, "index.js");
  const outfile = path.join(target, TARGET_FILE);

  const pathExists = await fse.pathExists(index);
  if (!pathExists) {
    throw `Failed to bundle \`${handler}\`, file \`${index}\` not found...`;
  }

  try {
    await build({
      bundle: true,
      entryPoints: [index],
      external: ["sharp"],
      format: "cjs",
      legalComments: "none" /** Handler code is not distributed */,
      minify: true,
      outfile,
      platform: "node",
      target: getTarget(
        runtime
          ? typeof runtime === "string"
            ? runtime
            : runtime[handler as keyof typeof runtime]
          : undefined
      )
    });
  } catch (error) {
    throw `Esbuild failed to bundle \`${handler}\`.`;
  }

  const outputFiles = await readDirectoryFiles(target, [
    outfile,
    "**/BUILD_ID"
  ]);

  // Remove all output files after bundling
  await Promise.all(
    Array.from(new Set(outputFiles)).map((file) => fse.remove(file.path))
  );

  const emptyDirectories = await readDirectoryFiles(
    target,
    [outfile, "**/BUILD_ID"],
    false
  );

  // Remove all empty leftover directories
  await Promise.all(
    emptyDirectories.map((dir) =>
      fse
        .remove(dir.path)
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .catch(() => {})
    )
  );
};
