import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "./src/default-handler.ts",
  output: {
    file: "dist/default-handler.js",
    format: "cjs"
  },
  plugins: [
    commonjs(),
    nodeResolve(),
    typescript({
      tsconfig: "tsconfig.bundle.json"
    })
  ],
  external: [
    "util",
    "aws-lambda",
    "./manifest.json",
    "aws-sdk/clients/s3",
    "./routes-manifest.json",
    "./prerender-manifest.json"
  ]
};
