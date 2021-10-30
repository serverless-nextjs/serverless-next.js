import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import externals from "rollup-plugin-node-externals";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";

const LOCAL_EXTERNALS = [
  "./manifest.json",
  "./api-manifest.json",
  "./routes-manifest.json",
  "./prerender-manifest.json",
  "./images-manifest.json",
  "./lambda-manifest.json"
];
const NPM_EXTERNALS = ["aws-lambda"];

const generateConfig = (input) => ({
  input: `./src/handlers/${input.handler}.ts`,
  output: {
    dir: `./dist/bundles/${input.handler}/${
      input.minify ? "minified" : "standard"
    }`,
    entryFileNames: "index.js",
    format: "cjs"
  },
  plugins: [
    json(),
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    externals({
      exclude: [
        "@sls-next/next-aws-cloudfront",
        "@sls-next/core",
        "@sls-next/aws-common",
        "next"
      ]
    }),
    typescript({
      tsconfig: "tsconfig.bundle.json"
    }),
    input.minify
      ? terser({
          compress: true,
          mangle: true,
          output: { comments: false } // Remove all comments, which is fine as the handler code is not distributed.
        })
      : undefined
  ],
  external: [...NPM_EXTERNALS, ...LOCAL_EXTERNALS]
});

export default [
  { handler: "default-handler", minify: false },
  { handler: "default-handler", minify: true },
  { handler: "image-handler", minify: false },
  { handler: "image-handler", minify: true }
].map(generateConfig);
